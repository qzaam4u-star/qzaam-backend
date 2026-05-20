const prisma = require('../src/config/prisma');

async function main() {
  try {
    const adminUsers = await prisma.user.findMany({
      where: { role: 'admin' }
    });
    console.log('Admin Users found:', adminUsers.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, passwordLength: u.password?.length })));
  } catch (e) {
    console.error('Error querying database:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
