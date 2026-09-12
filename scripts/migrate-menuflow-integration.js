/* eslint-disable no-console */
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const apply = process.argv.includes('--apply');

async function duplicateValues(collection, field) {
  return collection.aggregate([
    { $match: { [field]: { $type: 'string', $ne: '' } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 }, ids: { $push: '$id' } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 20 },
  ]).toArray();
}

async function main() {
  if (!uri) throw new Error('Defina MONGODB_URI antes de executar este script.');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  try {
    const users = db.collection('user_entity');
    const deliveries = db.collection('delivery');
    const [userDuplicates, deliveryDuplicates] = await Promise.all([
      duplicateValues(users, 'menuFlowCompanyId'),
      duplicateValues(deliveries, 'menuFlowOrderId'),
    ]);

    if (userDuplicates.length || deliveryDuplicates.length) {
      console.error('Existem vínculos duplicados que impedem a criação dos índices únicos. Nenhum dado foi alterado.');
      if (userDuplicates.length) console.error('menuFlowCompanyId duplicados:', userDuplicates);
      if (deliveryDuplicates.length) console.error('menuFlowOrderId duplicados:', deliveryDuplicates);
      process.exitCode = 2;
      return;
    }

    if (!apply) {
      console.log('Verificação concluída: não há duplicados. Rode novamente com --apply para criar os índices.');
      return;
    }

    await users.createIndex(
      { menuFlowCompanyId: 1 },
      {
        name: 'uq_user_menu_flow_company_id',
        unique: true,
        partialFilterExpression: { menuFlowCompanyId: { $type: 'string' } },
      },
    );
    await deliveries.createIndex(
      { menuFlowOrderId: 1 },
      {
        name: 'uq_delivery_menu_flow_order_id',
        unique: true,
        partialFilterExpression: { menuFlowOrderId: { $type: 'string' } },
      },
    );

    console.log('Índices da integração Menu Flow criados/confirmados com sucesso.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Migração da integração Menu Flow falhou:', error);
  process.exitCode = 1;
});
