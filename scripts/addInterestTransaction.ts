import prisma from '../src/utils/prisma';

async function main() {
  const userId = 1;
  const accountId = 10; // SeaBank
  const amount = 66;
  const categoryName = 'Bunga Bank';
  const description = 'Bunga SeaBank 08 Feb 2026';
  const transactionDate = new Date('2026-02-07T17:54:00.000Z'); // 08 Feb 00:54 WIB

  const category = await prisma.category.findFirst({
    where: { userId, name: categoryName, type: 'INCOME' }
  });

  if (!category) {
    throw new Error('Category Bunga Bank not found.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: accountId },
      data: { balance: { increment: amount } }
    });

    await tx.transaction.create({
      data: {
        amount,
        date: transactionDate,
        description,
        type: 'INCOME',
        categoryId: category.id,
        accountId,
        userId,
      }
    });
  });

  console.log('Transaction recorded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
