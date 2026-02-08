import prisma from '../src/utils/prisma';

async function main() {
  const account = await prisma.account.findUnique({ where: { id: 10 } });
  console.log(account);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
