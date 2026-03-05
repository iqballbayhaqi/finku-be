import prisma from '../src/utils/prisma';

const tables = ['User','Account','Category','Goal','Debt','Budget','Transaction','PlannedExpense'];

async function main() {
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"${table}"', 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 1) FROM "${table}"), 1)
      );
    `);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
