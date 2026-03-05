import prisma from '../src/utils/prisma';

async function main() {
  const transactions = await prisma.transaction.findMany({
    where: { userId: 1 },
    include: { category: true, account: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(transactions.map(t => ({
    id: t.id,
    amount: t.amount,
    type: t.type,
    category: t.category?.name,
    account: t.account?.name,
    date: t.date,
    description: t.description,
  })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
