import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GESTATION_DAYS = 283;

function daysAgo(days: number, hoursOffset = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hoursOffset, 15, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function main() {
  const ifEmptyOnly = process.argv.includes('--if-empty');
  if (ifEmptyOnly) {
    const existing = await prisma.cow.count();
    if (existing > 0) {
      console.log(`Database already has ${existing} cattle; skipping seed (--if-empty).`);
      return;
    }
  }

  console.log('Seeding GRanch database...');

  // Clear existing data in dependency order for idempotent re-seeding
  await prisma.dailyLog.deleteMany();
  await prisma.healthRecord.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.cow.updateMany({ data: { dam_id: null, sire_id: null } });
  await prisma.cow.deleteMany();

  // 1. Bulls (Sires)
  const bullB01 = await prisma.cow.create({
    data: {
      tag_number: 'B01',
      name: 'Duke',
      category: 'BULL',
      status: 'ACTIVE',
      breed: 'Black Angus',
      birth_date: daysAgo(1520),
      notes: 'Primary herd sire. Proven calving ease and strong weaning weights.',
    },
  });

  const bullB02 = await prisma.cow.create({
    data: {
      tag_number: 'B02',
      name: 'Copper',
      category: 'BULL',
      status: 'ACTIVE',
      breed: 'Red Angus',
      birth_date: daysAgo(1190),
      notes: 'Secondary sire running with South Creek heifers.',
    },
  });

  // 2. Mature Cows & Heifers
  const bred104 = daysAgo(271);
  const cow104 = await prisma.cow.create({
    data: {
      tag_number: '104',
      name: 'Clara',
      category: 'COW',
      status: 'PREGNANT',
      breed: 'Black Angus',
      birth_date: daysAgo(1860),
      breeding_date: bred104,
      expected_due_date: addDays(bred104, GESTATION_DAYS),
      notes: 'Heavy bred, bagging up nicely. Keep in maternity pasture.',
    },
  });

  const bred214 = daysAgo(280);
  const cow214 = await prisma.cow.create({
    data: {
      tag_number: '214',
      name: 'Bessie',
      category: 'COW',
      status: 'PREGNANT',
      breed: 'Hereford',
      birth_date: daysAgo(1640),
      breeding_date: bred214,
      expected_due_date: addDays(bred214, GESTATION_DAYS),
      notes: 'Due any day now. Check morning and evening.',
    },
  });

  const cow108 = await prisma.cow.create({
    data: {
      tag_number: '108',
      name: 'Hazel',
      category: 'COW',
      status: 'SICK',
      breed: 'Angus Cross',
      birth_date: daysAgo(1720),
      notes: 'Mild respiratory congestion, isolated in sick pen. Responding well to Draxxin.',
    },
  });

  const cow112 = await prisma.cow.create({
    data: {
      tag_number: '112',
      name: 'Ruby',
      category: 'COW',
      status: 'NURSING',
      breed: 'Red Angus',
      birth_date: daysAgo(1490),
      notes: 'Strong milker, attentive mother to calf #112-C1.',
    },
  });

  const cow115 = await prisma.cow.create({
    data: {
      tag_number: '115',
      name: 'Daisy',
      category: 'COW',
      status: 'NURSING',
      breed: 'Black Angus',
      birth_date: daysAgo(1340),
      notes: 'Calved unassisted on pasture. Calf #115-C1 vigorous.',
    },
  });

  const cow119 = await prisma.cow.create({
    data: {
      tag_number: '119',
      name: 'Maple',
      category: 'COW',
      status: 'ACTIVE',
      breed: 'Charolais Cross',
      birth_date: daysAgo(2010),
      notes: 'Open cow, scheduled for spring breeding group.',
    },
  });

  const bredY12 = daysAgo(265);
  const heiferY12 = await prisma.cow.create({
    data: {
      tag_number: 'Yellow-12',
      name: 'Sunny',
      category: 'HEIFER',
      status: 'PREGNANT',
      breed: 'Hereford',
      birth_date: daysAgo(810),
      breeding_date: bredY12,
      expected_due_date: addDays(bredY12, GESTATION_DAYS),
      dam_id: cow214.id,
      sire_id: bullB01.id,
      notes: 'First-calf heifer. Watch closely during labor.',
    },
  });

  const bredY15 = daysAgo(210);
  const heiferY15 = await prisma.cow.create({
    data: {
      tag_number: 'Yellow-15',
      name: 'Clover',
      category: 'HEIFER',
      status: 'PREGNANT',
      breed: 'Black Angus',
      birth_date: daysAgo(760),
      breeding_date: bredY15,
      expected_due_date: addDays(bredY15, GESTATION_DAYS),
      dam_id: cow104.id,
      sire_id: bullB02.id,
      notes: 'Preg-checked positive by Dr. Miller.',
    },
  });

  // 3. Calves & Steers (total 15 head)
  const calf112 = await prisma.cow.create({
    data: {
      tag_number: '112-C1',
      name: 'Rusty',
      category: 'CALF',
      status: 'ACTIVE',
      breed: 'Red Angus',
      birth_date: daysAgo(28),
      dam_id: cow112.id,
      sire_id: bullB02.id,
      notes: 'Bull calf. Birth weight approx 78 lbs.',
    },
  });

  const calf115 = await prisma.cow.create({
    data: {
      tag_number: '115-C1',
      name: 'Pepper',
      category: 'CALF',
      status: 'ACTIVE',
      breed: 'Black Angus',
      birth_date: daysAgo(19),
      dam_id: cow115.id,
      sire_id: bullB01.id,
      notes: 'Heifer calf. Tagged and navel dipped on day 1.',
    },
  });

  const steer204 = await prisma.cow.create({
    data: {
      tag_number: '204',
      category: 'STEER',
      status: 'ACTIVE',
      breed: 'Black Angus',
      birth_date: daysAgo(390),
      dam_id: cow119.id,
      sire_id: bullB01.id,
      notes: 'Treated for minor hoof abrasion. Hold until penicillin withdrawal clears.',
    },
  });

  const steer205 = await prisma.cow.create({
    data: {
      tag_number: '205',
      category: 'STEER',
      status: 'ACTIVE',
      breed: 'Hereford Cross',
      birth_date: daysAgo(375),
      dam_id: cow104.id,
      sire_id: bullB02.id,
      notes: 'Backgrounding lot steer, target sale weight 900 lbs.',
    },
  });

  const steer305 = await prisma.cow.create({
    data: {
      tag_number: '305',
      category: 'STEER',
      status: 'SOLD',
      breed: 'Black Angus',
      birth_date: daysAgo(450),
      dam_id: cow119.id,
      sire_id: bullB01.id,
      notes: 'Sold at County Livestock Auction, 865 lbs @ $2.47/lb.',
    },
  });

  // 4. Health Records (including active withdrawal flags)
  const draxxinDate = daysAgo(4, 8);
  await prisma.healthRecord.create({
    data: {
      cow_id: cow108.id,
      date: draxxinDate,
      type: 'MEDICATION',
      treatment_name: 'Draxxin',
      dosage: '11 ml SubQ',
      withdrawal_days: 18,
      safe_to_sell_date: addDays(draxxinDate, 18),
      notes: 'Treated for elevated temp (104.2F) and cough. Re-check in 4 days.',
    },
  });

  const penDate = daysAgo(3, 14);
  await prisma.healthRecord.create({
    data: {
      cow_id: steer204.id,
      date: penDate,
      type: 'INJURY',
      treatment_name: 'Penicillin G',
      dosage: '15 ml IM',
      withdrawal_days: 10,
      safe_to_sell_date: addDays(penDate, 10),
      notes: 'Cleaned minor front-left hoof abrasion and gave penicillin.',
    },
  });

  const vaxDate = daysAgo(24, 10);
  await prisma.healthRecord.create({
    data: {
      cow_id: calf112.id,
      date: vaxDate,
      type: 'VACCINATION',
      treatment_name: '7-Way Blackleg',
      dosage: '2 ml SubQ',
      withdrawal_days: 21,
      safe_to_sell_date: addDays(vaxDate, 21),
      notes: 'Initial clostridial calf vaccination.',
    },
  });

  await prisma.healthRecord.create({
    data: {
      cow_id: heiferY12.id,
      date: daysAgo(35, 11),
      type: 'CHECKUP',
      treatment_name: 'Fall Preg Check & Body Score',
      dosage: null,
      withdrawal_days: 0,
      safe_to_sell_date: null,
      notes: 'Confirmed pregnant, BCS 6.0, pelvis measurements good.',
    },
  });

  await prisma.healthRecord.create({
    data: {
      cow_id: bullB01.id,
      date: daysAgo(45, 9),
      type: 'VACCINATION',
      treatment_name: 'Bovi-Shield Gold FP 5',
      dosage: '2 ml IM',
      withdrawal_days: 21,
      safe_to_sell_date: addDays(daysAgo(45, 9), 21),
      notes: 'Annual breeding soundness exam & booster passed.',
    },
  });

  await prisma.healthRecord.create({
    data: {
      cow_id: cow115.id,
      date: daysAgo(19, 6),
      type: 'CALVING_ASSIST',
      treatment_name: 'Post-Calving Selenium & Check',
      dosage: '5 ml IM',
      withdrawal_days: 0,
      safe_to_sell_date: null,
      notes: 'Unassisted birth, verified placenta passed cleanly.',
    },
  });

  // 5. Transactions (8 realistic cash-flow entries)
  const txCattleSale = await prisma.transaction.create({
    data: {
      date: daysAgo(2, 13),
      type: 'INCOME',
      category: 'CATTLE_SALE',
      amount: new Prisma.Decimal('2140.00'),
      vendor_or_buyer: 'County Livestock Auction',
      cow_id: steer305.id,
      notes: 'Steer #305 sold at 865 lbs.',
    },
  });

  const txHaySale = await prisma.transaction.create({
    data: {
      date: daysAgo(9, 15),
      type: 'INCOME',
      category: 'HAY_CROP_SALE',
      amount: new Prisma.Decimal('1450.00'),
      vendor_or_buyer: 'Miller Family Farms',
      notes: 'Sold 20 round bales of surplus second-cutting grass hay.',
    },
  });

  const txFeedCoop = await prisma.transaction.create({
    data: {
      date: daysAgo(0, 8),
      type: 'EXPENSE',
      category: 'FEED_HAY',
      amount: new Prisma.Decimal('640.00'),
      vendor_or_buyer: 'Valley Ag Co-op',
      notes: '40 bags range cubes + 6 mineral tubs for winter pasture.',
    },
  });

  const txVetMeds = await prisma.transaction.create({
    data: {
      date: daysAgo(4, 10),
      type: 'EXPENSE',
      category: 'VET_MEDS',
      amount: new Prisma.Decimal('285.50'),
      vendor_or_buyer: 'Prairie View Vet Clinic',
      cow_id: cow108.id,
      notes: 'Draxxin bottle, syringes, and fall vaccine restock.',
    },
  });

  const txFuel = await prisma.transaction.create({
    data: {
      date: daysAgo(1, 16),
      type: 'EXPENSE',
      category: 'FUEL_EQUIPMENT',
      amount: new Prisma.Decimal('310.25'),
      vendor_or_buyer: 'Cenex Bulk Fuel',
      notes: 'Off-road dyed diesel delivery for loader tractor.',
    },
  });

  const txFencing = await prisma.transaction.create({
    data: {
      date: daysAgo(5, 11),
      type: 'EXPENSE',
      category: 'FENCING_REPAIRS',
      amount: new Prisma.Decimal('420.00'),
      vendor_or_buyer: 'Tractor Supply Co.',
      notes: 'T-posts, high-tensile wire roll, and solar charger insulators.',
    },
  });

  const txLabor = await prisma.transaction.create({
    data: {
      date: daysAgo(14, 17),
      type: 'EXPENSE',
      category: 'LABOR',
      amount: new Prisma.Decimal('550.00'),
      vendor_or_buyer: 'Jake Henderson (Ranch Hand)',
      notes: 'Weekend chute work, sorting steers, and corral gate weld.',
    },
  });

  const txUtilities = await prisma.transaction.create({
    data: {
      date: daysAgo(42, 12),
      type: 'EXPENSE',
      category: 'UTILITIES_PROPERTY',
      amount: new Prisma.Decimal('245.00'),
      vendor_or_buyer: 'Rural Electric Co-op',
      notes: 'Barn power and stock tank heaters billing cycle.',
    },
  });

  // 6. Daily Logs (10 chronological field activity logs)
  await prisma.dailyLog.createMany({
    data: [
      {
        timestamp: daysAgo(0, 10),
        category: 'FEEDING',
        summary: 'Picked up range cubes & mineral tubs at Valley Ag Co-op ($640) and set out 2 tubs in North Maternity pasture.',
        raw_transcript: 'Bought $640 of range cubes and mineral tubs at Valley Ag Co-op and put two out in the north maternity pasture',
        transaction_id: txFeedCoop.id,
      },
      {
        timestamp: daysAgo(0, 7),
        category: 'HEALTH_VET',
        summary: 'Morning pen check on Cow #108 (Hazel): appetite improved, temperature down to 101.8F.',
        raw_transcript: 'Checked on cow 108 Hazel this morning, she is eating hay again and temp is down to 101.8',
        cow_id: cow108.id,
      },
      {
        timestamp: daysAgo(1, 16),
        category: 'EQUIPMENT',
        summary: 'Filled bulk diesel tank ($310.25) and greased front loader pins on John Deere 5075E.',
        raw_transcript: 'Got $310.25 of off-road diesel from Cenex and greased the 5075E loader',
        transaction_id: txFuel.id,
      },
      {
        timestamp: daysAgo(1, 11),
        category: 'PASTURE_ROTATION',
        summary: 'Rotated 4 bred cows and heifers (including #104 & #214) into closer Maternity Paddock for calving watch.',
        raw_transcript: 'Moved the heavy bred cows including 104 and 214 into the maternity paddock near the barn',
        cow_id: cow214.id,
      },
      {
        timestamp: daysAgo(2, 14),
        category: 'GENERAL',
        summary: 'Sold Steer #305 at County Livestock Auction for $2,140.00. Marked Sold.',
        raw_transcript: 'Sold steer 305 at County Livestock Auction for $2140',
        cow_id: steer305.id,
        transaction_id: txCattleSale.id,
      },
      {
        timestamp: daysAgo(3, 14),
        category: 'HEALTH_VET',
        summary: 'Treated Steer #204 hoof abrasion with 15ml Penicillin G [10d withdrawal].',
        raw_transcript: 'Steer 204 had a cut on his front left hoof, cleaned it and gave him 15ml penicillin',
        cow_id: steer204.id,
      },
      {
        timestamp: daysAgo(4, 9),
        category: 'HEALTH_VET',
        summary: 'Administered 11ml Draxxin to Cow #108 for respiratory congestion [18d withdrawal] and moved to sick pen.',
        raw_transcript: 'Cow 108 is coughing with a fever, gave her 11ml of Draxxin and put her in the sick pen',
        cow_id: cow108.id,
        transaction_id: txVetMeds.id,
      },
      {
        timestamp: daysAgo(5, 13),
        category: 'FENCING_MAINTENANCE',
        summary: 'Replaced 6 rotted cedar posts and re-tensioned 200 yards of wire along East Creek boundary.',
        raw_transcript: 'Fixed six broken posts and stretched wire on the east creek fence line',
        transaction_id: txFencing.id,
      },
      {
        timestamp: daysAgo(9, 15),
        category: 'FEEDING',
        summary: 'Loaded 20 surplus grass hay round bales for Miller Family Farms ($1,450 income).',
        transaction_id: txHaySale.id,
      },
      {
        timestamp: daysAgo(19, 7),
        category: 'CALVING',
        summary: 'Heifer calf (#115-C1) born to Cow #115 (Daisy) unassisted. Dam set to Nursing.',
        raw_transcript: 'Cow 115 had a healthy heifer calf this morning, tagged her 115-C1',
        cow_id: cow115.id,
      },
    ],
  });

  // Touch unused references cleanly for TS strictness
  void [heiferY15, calf115, steer205, txUtilities, txLabor];

  const [cowCount, healthCount, logCount, txCount] = await Promise.all([
    prisma.cow.count(),
    prisma.healthRecord.count(),
    prisma.dailyLog.count(),
    prisma.transaction.count(),
  ]);

  console.log(
    `Seed complete: ${cowCount} cattle, ${healthCount} health records, ${logCount} daily logs, ${txCount} transactions.`
  );
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
