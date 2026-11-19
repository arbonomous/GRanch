import { prisma } from './prisma';
import {
  ACTIVE_COW_STATUSES,
  TRANSACTION_CATEGORY_LABELS,
  TransactionCategory,
} from './constants';
import {
  addDays,
  daysUntil,
  formatCurrency,
  formatShortDate,
  getMonthStart,
  getYearStart,
  startOfDay,
} from './dates';

export async function getDashboardData() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const in30Days = addDays(todayStart, 30);
  const monthStart = getMonthStart(now);
  const yearStart = getYearStart(now);

  const [cows, activeWithdrawals, yearTransactions, recentLogs] = await Promise.all([
    prisma.cow.findMany({
      select: {
        id: true,
        tag_number: true,
        name: true,
        category: true,
        status: true,
        expected_due_date: true,
      },
    }),
    prisma.healthRecord.findMany({
      where: {
        safe_to_sell_date: {
          gt: todayStart,
        },
        cow: {
          status: { in: ACTIVE_COW_STATUSES },
        },
      },
      include: {
        cow: {
          select: { id: true, tag_number: true, name: true, status: true },
        },
      },
      orderBy: { safe_to_sell_date: 'asc' },
    }),
    prisma.transaction.findMany({
      where: {
        date: { gte: yearStart },
      },
      select: {
        id: true,
        date: true,
        type: true,
        category: true,
        amount: true,
      },
    }),
    prisma.dailyLog.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
      include: {
        cow: { select: { id: true, tag_number: true, name: true } },
        transaction: {
          select: { id: true, type: true, amount: true, category: true },
        },
      },
    }),
  ]);

  const activeCows = cows.filter((c) =>
    ACTIVE_COW_STATUSES.includes(c.status as (typeof ACTIVE_COW_STATUSES)[number])
  );

  const totalActiveHead = activeCows.length;
  const cowCount = activeCows.filter((c) => c.category === 'COW' || c.category === 'HEIFER').length;
  const matureCowCount = activeCows.filter((c) => c.category === 'COW').length;
  const heiferCount = activeCows.filter((c) => c.category === 'HEIFER').length;
  const bullCount = activeCows.filter((c) => c.category === 'BULL').length;
  const calfCount = activeCows.filter((c) => c.category === 'CALF').length;
  const steerCount = activeCows.filter((c) => c.category === 'STEER').length;

  const pregnantCows = activeCows.filter((c) => c.status === 'PREGNANT');
  const dueSoonCows = pregnantCows.filter(
    (c) => c.expected_due_date && c.expected_due_date <= in30Days
  );

  const sickCowIds = new Set(
    activeCows.filter((c) => c.status === 'SICK').map((c) => c.id)
  );
  const withdrawalCowIds = new Set(activeWithdrawals.map((w) => w.cow_id));
  const alertCowIds = new Set([...sickCowIds, ...withdrawalCowIds]);

  let monthIn = 0;
  let monthOut = 0;
  let ytdIn = 0;
  let ytdOut = 0;

  for (const tx of yearTransactions) {
    const amt = Number(tx.amount);
    if (tx.type === 'INCOME') {
      ytdIn += amt;
      if (tx.date >= monthStart) monthIn += amt;
    } else {
      ytdOut += amt;
      if (tx.date >= monthStart) monthOut += amt;
    }
  }

  return {
    generatedAt: now.toISOString(),
    herd: {
      totalActiveHead,
      cows: matureCowCount,
      cowsAndHeifers: cowCount,
      heifers: heiferCount,
      bulls: bullCount,
      calves: calfCount,
      steers: steerCount,
      pregnant: pregnantCows.length,
      dueWithin30Days: dueSoonCows.length,
      sick: sickCowIds.size,
      activeWithdrawals: withdrawalCowIds.size,
      sickOrWithdrawal: alertCowIds.size,
      sold: cows.filter((c) => c.status === 'SOLD').length,
    },
    cashFlow: {
      month: {
        income: Number(monthIn.toFixed(2)),
        expenses: Number(monthOut.toFixed(2)),
        net: Number((monthIn - monthOut).toFixed(2)),
      },
      ytd: {
        income: Number(ytdIn.toFixed(2)),
        expenses: Number(ytdOut.toFixed(2)),
        net: Number((ytdIn - ytdOut).toFixed(2)),
      },
    },
    withdrawalAlerts: activeWithdrawals.map((w) => ({
      id: w.id,
      cow_id: w.cow_id,
      tag_number: w.cow.tag_number,
      cow_name: w.cow.name,
      treatment_name: w.treatment_name,
      safe_to_sell_date: w.safe_to_sell_date,
    })),
    recentLogs: recentLogs.map((l) => ({
      ...l,
      transaction: l.transaction
        ? { ...l.transaction, amount: Number(l.transaction.amount) }
        : null,
    })),
  };
}

export async function getFinancialSummary(
  timeframe: 'month' | 'year' | 'all' = 'month',
  category?: string
) {
  const now = new Date();
  const dateFilter =
    timeframe === 'month'
      ? { gte: getMonthStart(now) }
      : timeframe === 'year'
      ? { gte: getYearStart(now) }
      : undefined;

  const transactions = await prisma.transaction.findMany({
    where: {
      ...(dateFilter ? { date: dateFilter } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: { date: 'desc' },
    include: {
      cow: { select: { id: true, tag_number: true, name: true } },
    },
  });

  let income = 0;
  let expenses = 0;
  const byCategory: Record<string, { type: string; total: number; count: number }> = {};

  for (const tx of transactions) {
    const amt = Number(tx.amount);
    if (tx.type === 'INCOME') income += amt;
    else expenses += amt;

    if (!byCategory[tx.category]) {
      byCategory[tx.category] = { type: tx.type, total: 0, count: 0 };
    }
    byCategory[tx.category].total = Number((byCategory[tx.category].total + amt).toFixed(2));
    byCategory[tx.category].count += 1;
  }

  return {
    timeframe,
    income: Number(income.toFixed(2)),
    expenses: Number(expenses.toFixed(2)),
    net: Number((income - expenses).toFixed(2)),
    count: transactions.length,
    byCategory,
    transactions: transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
    })),
  };
}

export async function getDueDatesReport(withinDays = 90) {
  const todayStart = startOfDay(new Date());
  const cutoff = addDays(todayStart, withinDays);

  const pregnant = await prisma.cow.findMany({
    where: {
      status: 'PREGNANT',
    },
    orderBy: { expected_due_date: 'asc' },
    select: {
      id: true,
      tag_number: true,
      name: true,
      category: true,
      breed: true,
      breeding_date: true,
      expected_due_date: true,
    },
  });

  return pregnant.map((c) => ({
    ...c,
    days_until_due: c.expected_due_date ? daysUntil(c.expected_due_date) : null,
    due_within_window: c.expected_due_date ? c.expected_due_date <= cutoff : false,
  }));
}

export async function lookupCowByTag(rawTag: string) {
  const clean = rawTag.trim().replace(/^#/, '');
  const all = await prisma.cow.findMany({ select: { id: true, tag_number: true } });
  const match = all.find((c) => c.tag_number.toLowerCase() === clean.toLowerCase());
  if (!match) return null;

  return prisma.cow.findUnique({
    where: { id: match.id },
    include: {
      dam: { select: { id: true, tag_number: true, name: true, category: true } },
      sire: { select: { id: true, tag_number: true, name: true, category: true } },
      calves_as_dam: {
        select: { id: true, tag_number: true, name: true, category: true, status: true, birth_date: true },
        orderBy: { birth_date: 'desc' },
      },
      calves_as_sire: {
        select: { id: true, tag_number: true, name: true, category: true, status: true, birth_date: true },
        orderBy: { birth_date: 'desc' },
      },
      health_records: { orderBy: { date: 'desc' } },
      daily_logs: {
        orderBy: { timestamp: 'desc' },
        take: 15,
        include: {
          transaction: { select: { id: true, type: true, amount: true, category: true } },
        },
      },
      transactions: { orderBy: { date: 'desc' } },
    },
  });
}

/**
 * Answers either structured Instinct AI query actions OR free-form natural language ranch questions
 * (including compound multi-part questions like "How many cows are pregnant and what did I spend on feed this month?").
 */
export async function executeAiQuery(input: {
  question?: string;
  action?:
    | 'herd_summary'
    | 'due_dates'
    | 'cow_lookup'
    | 'financial_summary'
    | 'recent_logs'
    | 'sick_and_withdrawals';
  params?: {
    tag_number?: string;
    timeframe?: 'month' | 'year' | 'all';
    category?: string;
    days?: number;
    limit?: number;
  };
}) {
  if (input.action) {
    switch (input.action) {
      case 'herd_summary': {
        const dash = await getDashboardData();
        const h = dash.herd;
        const summary = `You have ${h.totalActiveHead} active head: ${h.cows} cows, ${h.heifers} heifers, ${h.bulls} bulls, ${h.calves} calves, and ${h.steers} steers. ${h.pregnant} are pregnant (${h.dueWithin30Days} due within 30 days), and ${h.sickOrWithdrawal} have active sick or withdrawal flags.`;
        return { action: 'herd_summary', summary, data: h };
      }
      case 'due_dates': {
        const days = input.params?.days ?? 30;
        const dueList = await getDueDatesReport(days);
        const upcoming = dueList.filter((c) => c.due_within_window);
        const summary =
          upcoming.length === 0
            ? `No cows are due within the next ${days} days (${dueList.length} total pregnant).`
            : `${dueList.length} pregnant total; ${upcoming.length} due within ${days} days: ${upcoming
                .map(
                  (c) =>
                    `#${c.tag_number} (${formatShortDate(c.expected_due_date)}, ${
                      c.days_until_due !== null && c.days_until_due >= 0
                        ? `in ${c.days_until_due}d`
                        : 'overdue'
                    })`
                )
                .join(', ')}.`;
        return { action: 'due_dates', summary, data: { total_pregnant: dueList.length, upcoming, all_pregnant: dueList } };
      }
      case 'cow_lookup': {
        const tag = input.params?.tag_number;
        if (!tag) {
          return { action: 'cow_lookup', summary: 'Please specify a tag_number to look up.', data: null };
        }
        const cow = await lookupCowByTag(tag);
        if (!cow) {
          return { action: 'cow_lookup', summary: `No animal found with tag #${tag}.`, data: null };
        }
        const todayStart = startOfDay(new Date());
        const activeWithdrawal = cow.health_records.find(
          (h) => h.safe_to_sell_date && h.safe_to_sell_date > todayStart
        );
        const parts = [
          `#${cow.tag_number}${cow.name ? ` (${cow.name})` : ''} is a ${cow.breed ? `${cow.breed} ` : ''}${cow.category.toLowerCase()}, currently ${cow.status.toLowerCase()}.`,
        ];
        if (cow.expected_due_date) {
          parts.push(`Expected due ${formatShortDate(cow.expected_due_date)}.`);
        }
        if (activeWithdrawal) {
          parts.push(
            `Active withdrawal from ${activeWithdrawal.treatment_name} until ${formatShortDate(activeWithdrawal.safe_to_sell_date)}.`
          );
        }
        if (cow.calves_as_dam.length > 0) {
          parts.push(
            `Offspring: ${cow.calves_as_dam.map((k) => `#${k.tag_number}`).join(', ')}.`
          );
        }
        return { action: 'cow_lookup', summary: parts.join(' '), data: cow };
      }
      case 'financial_summary': {
        const timeframe = input.params?.timeframe ?? 'month';
        const fin = await getFinancialSummary(timeframe, input.params?.category);
        const periodLabel =
          timeframe === 'month' ? 'this month' : timeframe === 'year' ? 'this year' : 'all time';
        const catLabel = input.params?.category
          ? ` for ${TRANSACTION_CATEGORY_LABELS[input.params.category as TransactionCategory] ?? input.params.category}`
          : '';
        const summary = `Cash flow ${periodLabel}${catLabel}: ${formatCurrency(fin.income)} in, ${formatCurrency(fin.expenses)} out, net ${formatCurrency(fin.net)}.`;
        return { action: 'financial_summary', summary, data: fin };
      }
      case 'recent_logs': {
        const limit = input.params?.limit ?? 10;
        const logs = await prisma.dailyLog.findMany({
          take: limit,
          where: input.params?.category ? { category: input.params.category } : undefined,
          orderBy: { timestamp: 'desc' },
          include: { cow: { select: { tag_number: true } } },
        });
        const summary =
          logs.length === 0
            ? 'No recent daily logs found.'
            : `Last ${logs.length} logs: ${logs
                .slice(0, 3)
                .map((l) => l.summary)
                .join(' | ')}`;
        return { action: 'recent_logs', summary, data: logs };
      }
      case 'sick_and_withdrawals': {
        const dash = await getDashboardData();
        const sickCows = await prisma.cow.findMany({
          where: { status: 'SICK' },
          select: { id: true, tag_number: true, name: true, notes: true },
        });
        const parts: string[] = [];
        if (sickCows.length > 0) {
          parts.push(
            `Sick animals (${sickCows.length}): ${sickCows.map((c) => `#${c.tag_number}`).join(', ')}.`
          );
        } else {
          parts.push('No animals are currently marked sick.');
        }
        if (dash.withdrawalAlerts.length > 0) {
          parts.push(
            `Active withdrawals (${dash.withdrawalAlerts.length}): ${dash.withdrawalAlerts
              .map(
                (w) =>
                  `#${w.tag_number} (${w.treatment_name}, clear ${formatShortDate(w.safe_to_sell_date)})`
              )
              .join(', ')}.`
          );
        } else {
          parts.push('No active medication withdrawals.');
        }
        return {
          action: 'sick_and_withdrawals',
          summary: parts.join(' '),
          data: { sick: sickCows, withdrawals: dash.withdrawalAlerts },
        };
      }
    }
  }

  // Natural language compound question parser
  const q = (input.question ?? '').trim();
  const qLower = q.toLowerCase();
  const summaryParts: string[] = [];
  const data: Record<string, unknown> = {};

  // Check for specific animal lookup
  const tagMatch = q.match(
    /\b(?:cow|bull|heifer|steer|calf|tag)\s*#?\s*([A-Za-z]+-\d+|[A-Za-z]\d+|\d+[A-Za-z]?)\b/i
  );
  if (tagMatch) {
    const res = await executeAiQuery({
      action: 'cow_lookup',
      params: { tag_number: tagMatch[1] },
    });
    summaryParts.push(res.summary);
    data.cow = res.data;
  }

  // Check for pregnant / due dates
  if (/\b(pregnant|due|calving|bred|expecting)\b/i.test(qLower)) {
    const dueRes = await executeAiQuery({ action: 'due_dates', params: { days: 30 } });
    summaryParts.push(dueRes.summary);
    data.due_dates = dueRes.data;
  }

  // Check for sick / withdrawal
  if (/\b(sick|withdrawal|safe to sell|ill|med|treat)\b/i.test(qLower)) {
    const sickRes = await executeAiQuery({ action: 'sick_and_withdrawals' });
    summaryParts.push(sickRes.summary);
    data.sick_and_withdrawals = sickRes.data;
  }

  // Check for herd count / inventory
  if (
    /\b(how many|head count|herd|total|bulls|calves|steers|heifers|cows)\b/i.test(qLower) &&
    !(/\bpregnant\b/i.test(qLower) && !/\b(total|head|herd|bulls|calves)\b/i.test(qLower))
  ) {
    const herdRes = await executeAiQuery({ action: 'herd_summary' });
    summaryParts.push(herdRes.summary);
    data.herd_summary = herdRes.data;
  }

  // Check for finances / spend / income / profit
  if (/\b(spend|spent|expense|income|profit|net|cash|money|cost|feed|hay|vet|fuel|fencing|sale|sold|earned)\b/i.test(qLower)) {
    const timeframe: 'month' | 'year' | 'all' = /\b(year|ytd|annual)\b/i.test(qLower)
      ? 'year'
      : /\b(all time|ever|total)\b/i.test(qLower) && !/\bmonth\b/i.test(qLower)
      ? 'all'
      : 'month';

    let category: TransactionCategory | undefined;
    if (/\b(feed|hay|mineral|grain)\b/i.test(qLower)) category = 'FEED_HAY';
    else if (/\b(vet|med|vaccine|medicine)\b/i.test(qLower)) category = 'VET_MEDS';
    else if (/\b(fuel|diesel|equipment|tractor)\b/i.test(qLower)) category = 'FUEL_EQUIPMENT';
    else if (/\b(fenc|wire|post)\b/i.test(qLower)) category = 'FENCING_REPAIRS';
    else if (/\b(labor|hand|crew)\b/i.test(qLower)) category = 'LABOR';
    else if (/\b(cattle sale|sold cattle)\b/i.test(qLower)) category = 'CATTLE_SALE';

    const fin = await getFinancialSummary(timeframe, category);
    const periodLabel =
      timeframe === 'month' ? 'this month' : timeframe === 'year' ? 'this year' : 'all time';

    if (category) {
      const catLabel = TRANSACTION_CATEGORY_LABELS[category];
      const total = fin.expenses > 0 ? fin.expenses : fin.income;
      summaryParts.push(
        `You ${fin.expenses > 0 ? 'spent' : 'logged'} ${formatCurrency(total)} on ${catLabel} ${periodLabel} (${fin.count} ${fin.count === 1 ? 'entry' : 'entries'}).`
      );
    } else {
      summaryParts.push(
        `Finances ${periodLabel}: ${formatCurrency(fin.income)} in, ${formatCurrency(fin.expenses)} out, net ${formatCurrency(fin.net)}.`
      );
    }
    data.financial_summary = fin;
  }

  // Check for recent logs / activity
  if (/\b(log|logs|activity|recent|today|yesterday|did we do|done)\b/i.test(qLower)) {
    const logRes = await executeAiQuery({ action: 'recent_logs', params: { limit: 5 } });
    summaryParts.push(logRes.summary);
    data.recent_logs = logRes.data;
  }

  // Default fallback: return full dashboard snapshot
  if (summaryParts.length === 0) {
    const dash = await getDashboardData();
    summaryParts.push(
      `Herd: ${dash.herd.totalActiveHead} active head (${dash.herd.pregnant} pregnant, ${dash.herd.sickOrWithdrawal} health alerts). This month cash flow: ${formatCurrency(dash.cashFlow.month.income)} in, ${formatCurrency(dash.cashFlow.month.expenses)} out (net ${formatCurrency(dash.cashFlow.month.net)}).`
    );
    data.dashboard = dash;
  }

  return {
    question: q,
    summary: summaryParts.join(' '),
    data,
  };
}
