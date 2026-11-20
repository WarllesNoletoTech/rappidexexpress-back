/*
 * Diagnóstico SOMENTE LEITURA para motoboys que não aparecem no seletor.
 * Exemplo: CITY_ID=... MONGODB_URI=... node scripts/diagnose-motoboys-city.js
 * Variáveis opcionais: MOTOBOY_NAME=<nome parcial> / DIAG_LIMIT=50
 * Nunca imprime senhas, tokens, PIX ou telefone.
 */
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const selectedCityId = String(process.env.CITY_ID || '').trim();
const suspect = String(process.env.MOTOBOY_NAME || '').toLocaleLowerCase('pt-BR').trim();
const limit = Math.min(Math.max(Number(process.env.DIAG_LIMIT) || 50, 1), 500);

function normalizedId(id) {
  return id == null ? '' : String(id).trim();
}

async function main() {
  if (!uri) throw new Error('Informe MONGODB_URI no ambiente da aplicação.');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const [cities, users] = await Promise.all([
      db.collection('city').find({}).project({ _id: 1, name: 1 }).toArray(),
      db.collection('user').find({ type: 'motoboy' })
        .project({ _id: 0, id: 1, name: 1, user: 1, type: 1, cityId: 1, isActive: 1, blocked: 1 })
        .toArray(),
    ]);
    const cityNames = new Map(cities.map((c) => [normalizedId(c._id), c.name || '(sem nome)']));
    const byCity = new Map();
    for (const user of users) {
      const cityId = normalizedId(user.cityId);
      byCity.set(cityId, (byCity.get(cityId) || 0) + 1);
    }
    console.log('Diagnóstico somente leitura: nenhuma conta será modificada.');
    console.log('Motoboys por cidade cadastrada:');
    for (const [cityId, count] of [...byCity].sort()) {
      console.log(`  ${cityId || '(sem cityId)'} - ${cityNames.get(cityId) || '(cidade não encontrada)'}: ${count}`);
    }

    const inspect = users.filter((user) => {
      if (suspect && !(user.name || '').toLocaleLowerCase('pt-BR').includes(suspect)) return false;
      if (selectedCityId) return normalizedId(user.cityId) === selectedCityId || !!suspect;
      return !normalizedId(user.cityId) || !cityNames.has(normalizedId(user.cityId)) || !!suspect;
    });
    console.log(`\nMotoboys para conferência (até ${limit}):`);
    for (const user of inspect.slice(0, limit)) {
      const cityId = normalizedId(user.cityId);
      const problems = [];
      if (!cityId) problems.push('SEM CIDADE');
      else if (!cityNames.has(cityId)) problems.push('CIDADE NÃO ENCONTRADA');
      if (selectedCityId && cityId !== selectedCityId) problems.push('FORA DA CIDADE SELECIONADA');
      if (user.isActive === false) problems.push('CADASTRO INATIVO (isso por si só não oculta no seletor atual)');
      console.log(JSON.stringify({
        id: user.id,
        name: user.name,
        user: user.user,
        cityId,
        cityName: cityNames.get(cityId) || null,
        cityIdStorageType: user.cityId && typeof user.cityId === 'object' ? 'ObjectId' : typeof user.cityId,
        issues: problems,
      }));
    }
    console.log('\nSe a cidade estiver errada, corrija no cadastro do usuário com perfil autorizado. Não altere via script automaticamente.');
  } finally {
    await client.close();
  }
}
main().catch((err) => { console.error('Diagnóstico falhou:', err.message); process.exitCode = 1; });
