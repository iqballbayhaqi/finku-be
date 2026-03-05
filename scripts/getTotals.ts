import prisma from '../src/utils/prisma';

async function main() {
  const accounts = await prisma.account.findMany({
    where: { userId: 1 },
    select: { id: true, name: true, type: true, balance: true }
  });
  const total = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  console.log({ total, accounts });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
