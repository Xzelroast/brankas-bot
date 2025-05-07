const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const warehouseFile = path.resolve(__dirname, 'warehouse.json');
const masterItemsFile = path.resolve(__dirname, 'masterItems.json');

let warehouse = {};
let masterItems = [];

function loadWarehouse() {
  if (fs.existsSync(warehouseFile)) {
    warehouse = JSON.parse(fs.readFileSync(warehouseFile, 'utf8'));
  } else {
    warehouse = {};
  }
}

function saveWarehouse() {
  fs.writeFileSync(warehouseFile, JSON.stringify(warehouse, null, 2), 'utf8');
}

function loadMasterItems() {
  if (fs.existsSync(masterItemsFile)) {
    masterItems = JSON.parse(fs.readFileSync(masterItemsFile, 'utf8'));
  } else {
    masterItems = [];
  }
}

function saveMasterItems() {
  fs.writeFileSync(masterItemsFile, JSON.stringify(masterItems, null, 2), 'utf8');
}

function normalizeItemName(item) {
  return item.trim().toLowerCase();
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  loadWarehouse();
  loadMasterItems();
});

async function registerCommands() {
  const depositChoices = masterItems.map(item => ({ name: item, value: item }));
  const withdrawChoices = masterItems.map(item => ({ name: item, value: item }));

  const commands = [
    new SlashCommandBuilder()
      .setName('tambah')
      .setDescription('Tambah item baru ke master item')
      .addStringOption(opt => opt.setName('item').setDescription('Nama item').setRequired(true)),

    new SlashCommandBuilder()
      .setName('hapus')
      .setDescription('Hapus item dari master item')
      .addStringOption(opt => opt.setName('item').setDescription('Nama item').setRequired(true)),

    new SlashCommandBuilder()
      .setName('deposit')
      .setDescription('Deposit item ke gudang')
      .addStringOption(opt => opt.setName('item').setDescription('Nama item').setRequired(true).addChoices(...depositChoices))
      .addIntegerOption(opt => opt.setName('quantity').setDescription('Jumlah').setRequired(true)),

    new SlashCommandBuilder()
      .setName('withdraw')
      .setDescription('Withdraw item dari gudang')
      .addStringOption(opt => opt.setName('item').setDescription('Nama item').setRequired(true).addChoices(...withdrawChoices))
      .addIntegerOption(opt => opt.setName('quantity').setDescription('Jumlah').setRequired(true)),

    new SlashCommandBuilder()
      .setName('inventory')
      .setDescription('Tampilkan isi gudang'),

    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Tampilkan bantuan'),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered/updated.');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
}

// Initial registration on bot start
registerCommands();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'tambah') {
    const itemRaw = interaction.options.getString('item');
    const item = normalizeItemName(itemRaw);
    if (masterItems.includes(item)) {
      await interaction.reply(`Item **${item}** sudah ada di daftar master.`);
      return;
    }
    masterItems.push(item);
    saveMasterItems();

    // Re-register commands to update choices dynamically
    try {
      await registerCommands();
      console.log(`Commands updated after adding item: ${item}`);
    } catch (err) {
      console.error('Error updating commands:', err);
      await interaction.reply('Gagal memperbarui perintah setelah menambahkan item, silakan coba lagi.');
      return;
    }

    await interaction.reply(`Berhasil menambahkan item **${item}** ke daftar master.`);
  }
  else if (commandName === 'hapus') {
    const itemRaw = interaction.options.getString('item');
    const item = normalizeItemName(itemRaw);
    if (!masterItems.includes(item)) {
      await interaction.reply(`Item **${item}** tidak ditemukan di daftar master.`);
      return;
    }
    masterItems = masterItems.filter(i => i !== item);
    saveMasterItems();

    if (warehouse[item]) {
      delete warehouse[item];
      saveWarehouse();
    }

    // Re-register commands because choices changed
    try {
      await registerCommands();
      console.log(`Commands updated after removing item: ${item}`);
    } catch (err) {
      console.error('Error updating commands after removal:', err);
      await interaction.reply('Gagal memperbarui perintah setelah menghapus item, silakan coba lagi.');
      return;
    }

    await interaction.reply(`Berhasil menghapus item **${item}** dari daftar master dan gudang.`);
  }
  else if (commandName === 'deposit') {
    const itemRaw = interaction.options.getString('item');
    const item = normalizeItemName(itemRaw);
    const qty = interaction.options.getInteger('quantity');

    if (!masterItems.includes(item)) {
      await interaction.reply(`Item **${item}** tidak ada di daftar master. Silakan tambahkan dulu dengan /tambah.`);
      return;
    }

    warehouse[item] = (warehouse[item] || 0) + qty;
    saveWarehouse();
    await interaction.reply(`Berhasil deposit ${qty} **${item}**. Stok sekarang: ${warehouse[item]}`);
  }
  else if (commandName === 'withdraw') {
    const itemRaw = interaction.options.getString('item');
    const item = normalizeItemName(itemRaw);
    const qty = interaction.options.getInteger('quantity');

    if (!masterItems.includes(item)) {
      await interaction.reply(`Item **${item}** tidak ada di daftar master.`);
      return;
    }

    if (!warehouse[item] || warehouse[item] < qty) {
      await interaction.reply(`Stok tidak cukup. Stok tersedia: ${warehouse[item] || 0}`);
      return;
    }

    warehouse[item] -= qty;
    if (warehouse[item] === 0) delete warehouse[item];
    saveWarehouse();
    await interaction.reply(`Berhasil withdraw ${qty} **${item}**. Stok sekarang: ${warehouse[item] || 0}`);
  }
  else if (commandName === 'inventory') {
    if (Object.keys(warehouse).length === 0) {
      await interaction.reply('Gudang kosong.');
      return;
    }
    let inventoryList = 'Isi Gudang Saat Ini:\n';
    for (const [item, qty] of Object.entries(warehouse)) {
      inventoryList += `- **${item}**: ${qty}\n`;
    }
    if (inventoryList.length > 1900) {
      inventoryList = inventoryList.slice(0, 1900) + '...';
    }
    await interaction.reply(inventoryList);
  }
  else if (commandName === 'help') {
    const helpMsg = `
**Perintah Bot Gudang**
• /tambah item - Tambah item baru ke daftar master.
• /hapus item - Hapus item dari daftar master.
• /deposit item quantity - Deposit item ke gudang.
• /withdraw item quantity - Withdraw item dari gudang.
• /inventory - Tampilkan isi gudang.
• /help - Tampilkan pesan bantuan.
    `;
    await interaction.reply(helpMsg);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('Failed to login:', err);
});