const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const masterItemsFile = './masterItems.json';

function loadMasterItems() {
  if (fs.existsSync(masterItemsFile)) {
    try {
      const data = fs.readFileSync(masterItemsFile, 'utf8');
      const items = JSON.parse(data);
      return items.map(i => i.toLowerCase());
    } catch (err) {
      console.error('Error reading masterItems.json:', err);
      return [];
    }
  }
  return [];
}

const masterItems = loadMasterItems();

const depositChoices = masterItems.map(item => ({ name: item, value: item }));
const withdrawChoices = masterItems.map(item => ({ name: item, value: item }));

const commands = [
  new SlashCommandBuilder()
    .setName('tambah')
    .setDescription('Tambah item baru ke daftar master')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Nama item')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('hapus')
    .setDescription('Hapus item dari daftar master')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Nama item')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Deposit item ke gudang')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Pilih item')
        .setRequired(true)
        .addChoices(...depositChoices)
    )
    .addIntegerOption(option =>
      option.setName('quantity')
        .setDescription('Jumlah item')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Withdraw item dari gudang')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Pilih item')
        .setRequired(true)
        .addChoices(...withdrawChoices)
    )
    .addIntegerOption(option =>
      option.setName('quantity')
        .setDescription('Jumlah item')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Tampilkan isi gudang'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Tampilkan bantuan'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('Memulai pendaftaran slash commands dengan pilihan dinamis...');

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log('Berhasil mendaftarkan slash commands dengan pilihan dinamis.');
  } catch (error) {
    console.error('Gagal mendaftarkan slash commands:', error) ;
  } finally {
    process.exit();
  } } ) () ;