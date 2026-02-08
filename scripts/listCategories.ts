import prisma from '../src/utils/prisma';

async function main() {
  const categories = await prisma.category.findMany({
    where: { userId: 1 },
    select: { id: true, name: true, type: true }
  });
  console.log(categories);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
