import prisma from '../src/utils/prisma';

async function main() {
  const category = await prisma.category.upsert({
    where: { userId_name: { userId: 1, name: 'Bunga Bank' } },
    update: {},
    create: {
      name: 'Bunga Bank',
      type: 'INCOME',
      userId: 1,
    },
  });
  console.log(category);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
