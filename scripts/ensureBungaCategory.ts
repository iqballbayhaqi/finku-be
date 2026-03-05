import prisma from '../src/utils/prisma';

async function main() {
  let category = await prisma.category.findFirst({
    where: { userId: 1, name: 'Bunga Bank' },
  });
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: 'Bunga Bank',
        type: 'INCOME',
        userId: 1,
      },
    });
    console.log('Created category:', category);
  } else {
    console.log('Category exists:', category);
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
