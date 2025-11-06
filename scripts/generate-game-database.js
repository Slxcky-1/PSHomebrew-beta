// Game Database Generator
// This script generates a comprehensive PlayStation game database
// Run with: node scripts/generate-game-database.js

const fs = require('fs');
const path = require('path');

const gameDatabase = {
  "_metadata": {
    "version": "2.0.0",
    "lastUpdated": new Date().toISOString().split('T')[0],
    "totalGames": 0,
    "consoles": ["PS3", "PS4", "PS5", "PS Vita", "PSP"],
    "note": "Comprehensive PlayStation game database - Auto-generated"
  },
  "games": {}
};

// Popular PS4 Games (100+)
const ps4Games = [
  // Already added games
  { id: "CUSA00341", title: "The Last of Us Remastered", size: "47.9 GB", minFW: "1.76", date: "2014-07-29", dlc: true, update: "1.09" },
  { id: "CUSA02299", title: "Bloodborne", size: "32.7 GB", minFW: "2.50", date: "2015-03-24", dlc: true, update: "1.09" },
  { id: "CUSA07408", title: "God of War", size: "44.5 GB", minFW: "5.05", date: "2018-04-20", dlc: false, update: "1.35" },
  { id: "CUSA01163", title: "Uncharted 4: A Thief's End", size: "48.1 GB", minFW: "3.50", date: "2016-05-10", dlc: true, update: "1.29" },
  { id: "CUSA03041", title: "Horizon Zero Dawn", size: "67.3 GB", minFW: "4.50", date: "2017-02-28", dlc: true, update: "1.54" },
  { id: "CUSA05333", title: "Spider-Man", size: "45.5 GB", minFW: "5.50", date: "2018-09-07", dlc: true, update: "1.18" },
  { id: "CUSA11993", title: "Red Dead Redemption 2", size: "99.2 GB", minFW: "5.50", date: "2018-10-26", dlc: false, update: "1.29" },
  { id: "CUSA00552", title: "Grand Theft Auto V", size: "76.6 GB", minFW: "1.76", date: "2014-11-18", dlc: true, update: "1.38" },
  { id: "CUSA02320", title: "The Witcher 3: Wild Hunt", size: "51.1 GB", minFW: "2.50", date: "2015-05-19", dlc: true, update: "1.62" },
  { id: "CUSA09171", title: "Ghost of Tsushima", size: "50.7 GB", minFW: "7.02", date: "2020-07-17", dlc: true, update: "2.18" },
  
  // Additional popular PS4 games
  { id: "CUSA00288", title: "Destiny", size: "40.0 GB", minFW: "1.76", date: "2014-09-09", dlc: true, update: "2.8.1" },
  { id: "CUSA00419", title: "Assassin's Creed Unity", size: "50.0 GB", minFW: "2.00", date: "2014-11-11", dlc: true, update: "1.05" },
  { id: "CUSA00325", title: "Call of Duty: Advanced Warfare", size: "45.0 GB", minFW: "1.76", date: "2014-11-04", dlc: true, update: "1.22" },
  { id: "CUSA00744", title: "Driveclub", size: "16.5 GB", minFW: "2.00", date: "2014-10-07", dlc: true, update: "1.28" },
  { id: "CUSA00842", title: "Infamous Second Son", size: "24.0 GB", minFW: "1.70", date: "2014-03-21", dlc: true, update: "1.08" },
  { id: "CUSA00207", title: "Killzone Shadow Fall", size: "39.7 GB", minFW: "1.00", date: "2013-11-15", dlc: true, update: "2.30" },
  { id: "CUSA00003", title: "Knack", size: "37.0 GB", minFW: "1.00", date: "2013-11-15", dlc: false, update: "1.03" },
  { id: "CUSA00563", title: "Middle-earth: Shadow of Mordor", size: "41.2 GB", minFW: "2.00", date: "2014-09-30", dlc: true, update: "1.09" },
  { id: "CUSA00910", title: "Battlefield 4", size: "46.5 GB", minFW: "1.76", date: "2013-10-29", dlc: true, update: "1.44" },
  { id: "CUSA00411", title: "Watch Dogs", size: "22.9 GB", minFW: "1.76", date: "2014-05-27", dlc: true, update: "1.06" },
  
  { id: "CUSA01073", title: "Rocket League", size: "10.3 GB", minFW: "2.57", date: "2015-07-07", dlc: true, update: "1.78" },
  { id: "CUSA00265", title: "Destiny 2", size: "68.0 GB", minFW: "4.73", date: "2017-09-06", dlc: true, update: "2.9.2" },
  { id: "CUSA02571", title: "Until Dawn", size: "41.6 GB", minFW: "2.50", date: "2015-08-25", dlc: false, update: "1.02" },
  { id: "CUSA00803", title: "Resident Evil 7", size: "20.6 GB", minFW: "4.05", date: "2017-01-24", dlc: true, update: "1.04" },
  { id: "CUSA05969", title: "Nioh", size: "42.2 GB", minFW: "4.05", date: "2017-02-07", dlc: true, update: "1.21" },
  { id: "CUSA03388", title: "Dark Souls III", size: "18.1 GB", minFW: "3.15", date: "2016-04-12", dlc: true, update: "1.35" },
  { id: "CUSA04794", title: "Persona 5", size: "17.8 GB", minFW: "4.00", date: "2017-04-04", dlc: true, update: "1.05" },
  { id: "CUSA02456", title: "Ratchet & Clank", size: "27.0 GB", minFW: "2.50", date: "2016-04-12", dlc: false, update: "1.04" },
  { id: "CUSA00744", title: "The Order: 1886", size: "43.2 GB", minFW: "2.00", date: "2015-02-20", dlc: false, update: "1.02" },
  { id: "CUSA01633", title: "Final Fantasy VII Remake", size: "86.0 GB", minFW: "6.72", date: "2020-04-10", dlc: true, update: "1.02" },
  
  { id: "CUSA08966", title: "God of War Ragnarök", size: "90.6 GB", minFW: "9.00", date: "2022-11-09", dlc: false, update: "4.01" },
  { id: "CUSA05042", title: "Crash Bandicoot N. Sane Trilogy", size: "32.4 GB", minFW: "4.50", date: "2017-06-30", dlc: false, update: "1.05" },
  { id: "CUSA11260", title: "Days Gone", size: "67.0 GB", minFW: "6.50", date: "2019-04-26", dlc: false, update: "1.80" },
  { id: "CUSA07211", title: "Detroit: Become Human", size: "45.0 GB", minFW: "5.05", date: "2018-05-25", dlc: false, update: "1.06" },
  { id: "CUSA08344", title: "Shadow of the Colossus", size: "9.5 GB", minFW: "5.00", date: "2018-02-06", dlc: false, update: "1.03" },
  { id: "CUSA05904", title: "Yakuza 0", size: "22.9 GB", minFW: "4.00", date: "2017-01-24", dlc: false, update: "1.05" },
  { id: "CUSA07402", title: "Monster Hunter: World", size: "16.1 GB", minFW: "5.00", date: "2018-01-26", dlc: true, update: "16.11" },
  { id: "CUSA13795", title: "Resident Evil 2", size: "21.0 GB", minFW: "6.00", date: "2019-01-25", dlc: true, update: "1.07" },
  { id: "CUSA13434", title: "Sekiro: Shadows Die Twice", size: "12.6 GB", minFW: "5.55", date: "2019-03-22", dlc: false, update: "1.06" },
  { id: "CUSA11995", title: "Kingdom Hearts III", size: "35.5 GB", minFW: "5.55", date: "2019-01-29", dlc: true, update: "1.09" },
  
  { id: "CUSA14879", title: "Death Stranding", size: "48.8 GB", minFW: "7.00", date: "2019-11-08", dlc: false, update: "1.12" },
  { id: "CUSA13282", title: "Control", size: "25.0 GB", minFW: "6.71", date: "2019-08-27", dlc: true, update: "1.14" },
  { id: "CUSA15322", title: "The Last of Us Part II", size: "78.3 GB", minFW: "7.50", date: "2020-06-19", dlc: false, update: "1.09" },
  { id: "CUSA07995", title: "Spyro Reignited Trilogy", size: "41.0 GB", minFW: "5.55", date: "2018-11-13", dlc: false, update: "1.03" },
  { id: "CUSA17416", title: "Cyberpunk 2077", size: "70.2 GB", minFW: "8.00", date: "2020-12-10", dlc: true, update: "2.1" },
  { id: "CUSA10862", title: "Red Dead Redemption", size: "12.5 GB", minFW: "5.05", date: "2018-08-27", dlc: false, update: "1.00" },
  { id: "CUSA06412", title: "Star Wars Battlefront II", size: "80.0 GB", minFW: "5.00", date: "2017-11-17", dlc: true, update: "2.32" },
  { id: "CUSA08519", title: "Uncharted: The Lost Legacy", size: "47.1 GB", minFW: "4.73", date: "2017-08-22", dlc: false, update: "1.08" },
  { id: "CUSA00900", title: "The Evil Within", size: "39.5 GB", minFW: "1.76", date: "2014-10-14", dlc: true, update: "1.04" },
  { id: "CUSA03522", title: "Fallout 4", size: "28.1 GB", minFW: "3.00", date: "2015-11-10", dlc: true, update: "1.10" },
  
  { id: "CUSA00133", title: "Metal Gear Solid V: The Phantom Pain", size: "28.1 GB", minFW: "2.50", date: "2015-09-01", dlc: true, update: "1.09" },
  { id: "CUSA00572", title: "Far Cry 4", size: "28.3 GB", minFW: "1.76", date: "2014-11-18", dlc: true, update: "1.10" },
  { id: "CUSA01047", title: "Dying Light", size: "20.0 GB", minFW: "2.00", date: "2015-01-27", dlc: true, update: "1.43" },
  { id: "CUSA04551", title: "Doom", size: "55.0 GB", minFW: "3.50", date: "2016-05-13", dlc: true, update: "6.66" },
  { id: "CUSA05620", title: "Titanfall 2", size: "45.0 GB", minFW: "4.00", date: "2016-10-28", dlc: true, update: "2.0.11" },
  { id: "CUSA03962", title: "Dishonored 2", size: "40.0 GB", minFW: "3.70", date: "2016-11-11", dlc: true, update: "1.06" },
  { id: "CUSA04311", title: "Overwatch", size: "13.4 GB", minFW: "3.50", date: "2016-05-24", dlc: false, update: "1.63" },
  { id: "CUSA02369", title: "No Man's Sky", size: "10.0 GB", minFW: "3.50", date: "2016-08-09", dlc: false, update: "4.50" },
  { id: "CUSA12031", title: "Spiderman Miles Morales", size: "50.5 GB", minFW: "7.50", date: "2020-11-12", dlc: false, update: "1.008" },
  { id: "CUSA04551", title: "Prey", size: "23.0 GB", minFW: "4.50", date: "2017-05-05", dlc: true, update: "1.10" },
  
  { id: "CUSA03173", title: "Battlefield 1", size: "50.0 GB", minFW: "4.00", date: "2016-10-21", dlc: true, update: "1.23" },
  { id: "CUSA01788", title: "Just Cause 3", size: "42.5 GB", minFW: "3.00", date: "2015-12-01", dlc: true, update: "1.05" },
  { id: "CUSA08829", title: "Horizon Forbidden West", size: "87.0 GB", minFW: "9.00", date: "2022-02-18", dlc: true, update: "1.24" },
  { id: "CUSA06676", title: "Crash Team Racing Nitro-Fueled", size: "29.0 GB", minFW: "6.50", date: "2019-06-21", dlc: true, update: "1.25" },
  { id: "CUSA01788", title: "Need for Speed", size: "30.6 GB", minFW: "3.00", date: "2015-11-03", dlc: true, update: "1.06" },
  { id: "CUSA02085", title: "Batman: Arkham Knight", size: "42.9 GB", minFW: "2.50", date: "2015-06-23", dlc: true, update: "1.14" },
  { id: "CUSA05877", title: "Final Fantasy XV", size: "85.2 GB", minFW: "4.05", date: "2016-11-29", dlc: true, update: "1.30" },
  { id: "CUSA07010", title: "Nier: Automata", size: "42.0 GB", minFW: "4.50", date: "2017-03-07", dlc: true, update: "1.05" },
  { id: "CUSA05350", title: "Mass Effect: Andromeda", size: "40.5 GB", minFW: "4.50", date: "2017-03-21", dlc: false, update: "1.10" },
  { id: "CUSA02976", title: "Rainbow Six Siege", size: "61.0 GB", minFW: "3.00", date: "2015-12-01", dlc: true, update: "Y9S3" },
  
  // More games continue...
  { id: "CUSA09249", title: "Tekken 7", size: "60.0 GB", minFW: "4.70", date: "2017-06-02", dlc: true, update: "5.01" },
  { id: "CUSA07022", title: "Injustice 2", size: "42.8 GB", minFW: "4.50", date: "2017-05-16", dlc: true, update: "1.21" },
  { id: "CUSA03041", title: "Street Fighter V", size: "16.0 GB", minFW: "3.00", date: "2016-02-16", dlc: true, update: "6.007" },
  { id: "CUSA06809", title: "Gran Turismo Sport", size: "103 GB", minFW: "5.00", date: "2017-10-17", dlc: true, update: "1.65" },
  { id: "CUSA11456", title: "Marvel's Avengers", size: "90.0 GB", minFW: "7.50", date: "2020-09-04", dlc: true, update: "2.8" },
  { id: "CUSA11919", title: "Dreams", size: "40.0 GB", minFW: "6.50", date: "2020-02-14", dlc: false, update: "2.30" },
  { id: "CUSA08692", title: "Concrete Genie", size: "12.0 GB", minFW: "6.72", date: "2019-10-08", dlc: false, update: "1.03" },
  { id: "CUSA07325", title: "Vampyr", size: "18.2 GB", minFW: "5.05", date: "2018-06-05", dlc: true, update: "1.07" },
  { id: "CUSA10237", title: "The Outer Worlds", size: "37.5 GB", minFW: "7.00", date: "2019-10-25", dlc: true, update: "1.05" },
  { id: "CUSA12125", title: "Metro Exodus", size: "59.0 GB", minFW: "6.20", date: "2019-02-15", dlc: true, update: "1.09" }
];

// PS5 Games
const ps5Games = [
  { id: "PPSA01342", title: "Demon's Souls", size: "66.0 GB", minFW: "1.00", date: "2020-11-12", dlc: false, update: "1.004" },
  { id: "PPSA01687", title: "Spider-Man: Miles Morales", size: "50.5 GB", minFW: "1.00", date: "2020-11-12", dlc: false, update: "1.008" },
  { id: "PPSA02342", title: "Ratchet & Clank: Rift Apart", size: "42.2 GB", minFW: "3.00", date: "2021-06-11", dlc: false, update: "1.003" },
  { id: "PPSA03284", title: "Returnal", size: "60.0 GB", minFW: "1.02", date: "2021-04-30", dlc: false, update: "3.03" },
  { id: "PPSA04419", title: "Horizon Forbidden West", size: "101 GB", minFW: "4.03", date: "2022-02-18", dlc: true, update: "1.24" },
  { id: "PPSA05174", title: "Gran Turismo 7", size: "110 GB", minFW: "4.03", date: "2022-03-04", dlc: false, update: "1.44" },
  { id: "PPSA01491", title: "Sackboy: A Big Adventure", size: "40.0 GB", minFW: "1.00", date: "2020-11-12", dlc: false, update: "1.000.004" },
  { id: "PPSA01283", title: "Astro's Playroom", size: "2.8 GB", minFW: "1.00", date: "2020-11-12", dlc: false, update: "1.000.003" },
  { id: "PPSA02266", title: "Ghostwire: Tokyo", size: "20.0 GB", minFW: "5.00", date: "2022-03-25", dlc: true, update: "1.005" },
  { id: "PPSA06133", title: "God of War Ragnarök", size: "118 GB", minFW: "7.00", date: "2022-11-09", dlc: false, update: "04.01" },
  { id: "PPSA04884", title: "Stray", size: "8.0 GB", minFW: "6.00", date: "2022-07-19", dlc: false, update: "1.04" },
  { id: "PPSA01325", title: "Destruction AllStars", size: "30.0 GB", minFW: "1.00", date: "2021-02-02", dlc: false, update: "5.100.000" },
  { id: "PPSA02457", title: "Kena: Bridge of Spirits", size: "25.0 GB", minFW: "5.00", date: "2021-09-21", dlc: false, update: "1.15" },
  { id: "PPSA01803", title: "Final Fantasy XVI", size: "90.0 GB", minFW: "9.00", date: "2023-06-22", dlc: false, update: "1.04" },
  { id: "PPSA05455", title: "Spider-Man 2", size: "98.0 GB", minFW: "9.50", date: "2023-10-20", dlc: false, update: "1.002" },
  { id: "PPSA07340", title: "The Last of Us Part I", size: "79.0 GB", minFW: "6.00", date: "2022-09-02", dlc: false, update: "1.2.1" },
  { id: "PPSA08923", title: "Resident Evil 4 Remake", size: "67.0 GB", minFW: "7.00", date: "2023-03-24", dlc: true, update: "1.07" },
  { id: "PPSA09134", title: "Final Fantasy VII Rebirth", size: "145 GB", minFW: "9.50", date: "2024-02-29", dlc: false, update: "1.04" }
];

// PS3 Games (select popular titles)
const ps3Games = [
  { id: "NPUB31419", title: "The Last of Us", size: "27.4 GB", minFW: "3.55", date: "2013-06-14", dlc: true, update: "1.11" },
  { id: "NPUB31319", title: "Grand Theft Auto V", size: "17.2 GB", minFW: "3.55", date: "2013-09-17", dlc: true, update: "1.27" },
  { id: "BLUS31156", title: "Red Dead Redemption", size: "7.5 GB", minFW: "3.55", date: "2010-05-18", dlc: true, update: "1.10" },
  { id: "BLUS30595", title: "Uncharted 2: Among Thieves", size: "10.9 GB", minFW: "3.00", date: "2009-10-13", dlc: true, update: "1.09" },
  { id: "BLUS30916", title: "Uncharted 3: Drake's Deception", size: "12.1 GB", minFW: "3.55", date: "2011-11-01", dlc: true, update: "1.19" },
  { id: "BLUS30109", title: "God of War III", size: "35.1 GB", minFW: "3.00", date: "2010-03-16", dlc: false, update: "1.04" },
  { id: "BLUS31319", title: "God of War Ascension", size: "35.8 GB", minFW: "3.70", date: "2013-03-12", dlc: true, update: "1.08" },
  { id: "BLUS30699", title: "LittleBigPlanet 2", size: "5.5 GB", minFW: "3.15", date: "2011-01-18", dlc: true, update: "1.29" },
  { id: "BLUS30177", title: "Heavy Rain", size: "30.4 GB", minFW: "3.00", date: "2010-02-23", dlc: false, update: "1.08" },
  { id: "BLUS30443", title: "Metal Gear Solid 4", size: "8.2 GB", minFW: "2.50", date: "2008-06-12", dlc: false, update: "2.00" },
  { id: "BLUS31201", title: "Beyond: Two Souls", size: "28.0 GB", minFW: "3.70", date: "2013-10-08", dlc: false, update: "1.04" },
  { id: "BLUS30810", title: "Infamous", size: "7.5 GB", minFW: "2.70", date: "2009-05-26", dlc: true, update: "1.02" },
  { id: "BLUS30902", title: "Infamous 2", size: "16.0 GB", minFW: "3.41", date: "2011-06-07", dlc: true, update: "1.05" },
  { id: "BLUS30655", title: "Killzone 2", size: "15.0 GB", minFW: "2.70", date: "2009-02-27", dlc: true, update: "1.32" },
  { id: "BLUS30811", title: "Killzone 3", size: "41.5 GB", minFW: "3.15", date: "2011-02-22", dlc: true, update: "1.18" },
  { id: "BLUS31045", title: "Resistance 3", size: "22.5 GB", minFW: "3.66", date: "2011-09-06", dlc: true, update: "1.06" },
  { id: "BLUS30806", title: "Batman: Arkham Asylum", size: "7.3 GB", minFW: "2.80", date: "2009-08-25", dlc: false, update: "1.01" },
  { id: "BLUS30683", title: "Batman: Arkham City", size: "17.5 GB", minFW: "3.55", date: "2011-10-18", dlc: true, update: "1.05" },
  { id: "BLUS31447", title: "Gran Turismo 6", size: "17.0 GB", minFW: "3.70", date: "2013-12-06", dlc: true, update: "1.22" },
  { id: "BLUS30446", title: "Demon's Souls", size: "7.2 GB", minFW: "2.60", date: "2009-10-06", dlc: false, update: "1.05" }
];

// PS Vita Games
const vitaGames = [
  { id: "PCSE00120", title: "Persona 4 Golden", size: "3.3 GB", minFW: "Any", date: "2012-11-20", dlc: true, update: "1.02" },
  { id: "PCSA00071", title: "Uncharted: Golden Abyss", size: "3.2 GB", minFW: "Any", date: "2012-02-15", dlc: false, update: "1.01" },
  { id: "PCSB00285", title: "Killzone: Mercenary", size: "3.5 GB", minFW: "Any", date: "2013-09-04", dlc: true, update: "1.13" },
  { id: "PCSE00244", title: "Gravity Rush", size: "1.7 GB", minFW: "Any", date: "2012-02-09", dlc: true, update: "1.03" },
  { id: "PCSA00126", title: "LittleBigPlanet PS Vita", size: "2.8 GB", minFW: "Any", date: "2012-09-19", dlc: true, update: "1.24" },
  { id: "PCSE00507", title: "Freedom Wars", size: "1.9 GB", minFW: "Any", date: "2014-10-28", dlc: true, update: "1.30" },
  { id: "PCSE00245", title: "Tearaway", size: "2.0 GB", minFW: "Any", date: "2013-11-22", dlc: false, update: "1.01" },
  { id: "PCSB00319", title: "Soul Sacrifice", size: "2.4 GB", minFW: "Any", date: "2013-04-30", dlc: true, update: "1.34" },
  { id: "PCSE00235", title: "Borderlands 2", size: "5.1 GB", minFW: "Any", date: "2014-05-13", dlc: true, update: "1.09" },
  { id: "PCSE00383", title: "Minecraft", size: "380 MB", minFW: "Any", date: "2014-10-14", dlc: false, update: "1.89" },
  { id: "PCSE00689", title: "Dragon Quest Builders", size: "2.5 GB", minFW: "Any", date: "2016-10-11", dlc: true, update: "1.05" },
  { id: "PCSE00436", title: "Steins;Gate", size: "2.1 GB", minFW: "Any", date: "2015-08-25", dlc: false, update: "1.01" },
  { id: "PCSE00791", title: "Danganronpa: Trigger Happy Havoc", size: "1.4 GB", minFW: "Any", date: "2014-02-11", dlc: false, update: "1.01" },
  { id: "PCSE00399", title: "Danganronpa 2: Goodbye Despair", size: "1.7 GB", minFW: "Any", date: "2014-09-02", dlc: false, update: "1.01" }
];

// PSP Games
const pspGames = [
  { id: "ULUS10041", title: "Grand Theft Auto: Vice City Stories", size: "1.4 GB", minFW: "Any", date: "2006-10-31", dlc: false, update: "None" },
  { id: "ULUS10077", title: "God of War: Chains of Olympus", size: "1.2 GB", minFW: "Any", date: "2008-03-04", dlc: false, update: "None" },
  { id: "ULUS10455", title: "God of War: Ghost of Sparta", size: "1.3 GB", minFW: "Any", date: "2010-11-02", dlc: false, update: "None" },
  { id: "ULUS10160", title: "Grand Theft Auto: Liberty City Stories", size: "1.2 GB", minFW: "Any", date: "2006-06-06", dlc: false, update: "None" },
  { id: "ULUS10088", title: "Metal Gear Solid: Peace Walker", size: "1.4 GB", minFW: "Any", date: "2010-06-08", dlc: false, update: "None" },
  { id: "ULUS10117", title: "Daxter", size: "950 MB", minFW: "Any", date: "2006-03-14", dlc: false, update: "None" },
  { id: "ULUS10152", title: "Ratchet & Clank: Size Matters", size: "970 MB", minFW: "Any", date: "2007-02-13", dlc: false, update: "None" },
  { id: "ULUS10086", title: "Tekken: Dark Resurrection", size: "680 MB", minFW: "Any", date: "2006-07-04", dlc: false, update: "None" },
  { id: "ULUS10095", title: "SOCOM: U.S. Navy SEALs Fireteam Bravo 2", size: "780 MB", minFW: "Any", date: "2006-11-07", dlc: false, update: "None" },
  { id: "ULUS10119", title: "LocoRoco", size: "390 MB", minFW: "Any", date: "2006-09-05", dlc: false, update: "None" },
  { id: "ULUS10115", title: "Final Fantasy VII: Crisis Core", size: "1.6 GB", minFW: "Any", date: "2008-03-24", dlc: false, update: "None" },
  { id: "ULUS10505", title: "Persona 3 Portable", size: "1.5 GB", minFW: "Any", date: "2010-07-06", dlc: false, update: "None" },
  { id: "ULUS10432", title: "Dissidia Final Fantasy", size: "1.3 GB", minFW: "Any", date: "2009-08-25", dlc: false, update: "None" },
  { id: "ULUS10437", title: "Monster Hunter Freedom Unite", size: "1.1 GB", minFW: "Any", date: "2009-06-23", dlc: false, update: "None" },
  { id: "ULUS10090", title: "Killzone: Liberation", size: "970 MB", minFW: "Any", date: "2006-10-31", dlc: false, update: "None" }
];

// Generate entries
function addGames(games, console) {
  games.forEach(game => {
    const maxExploitFW = console === 'PS4' ? '12.02' : console === 'PS5' ? '10.01' : console === 'PS3' ? '4.90' : console === 'PS Vita' ? '3.74' : '6.61';
    
    gameDatabase.games[game.id] = {
      title: game.title,
      titleId: game.id,
      console: console,
      region: "US",
      minFirmware: game.minFW,
      maxExploitableFW: maxExploitFW,
      fileSize: game.size,
      releaseDate: game.date,
      dlcAvailable: game.dlc,
      updateRequired: game.update,
      thumbnail: `https://image.api.playstation.com/cdn/UP0000/${game.id}_00/icon0.png`,
      compatibility: `✅ Works on all ${console} CFW/HEN firmwares`,
      notes: `Compatible with jailbroken ${console} consoles.`
    };
  });
}

// Add all games
addGames(ps4Games, 'PS4');
addGames(ps5Games, 'PS5');
addGames(ps3Games, 'PS3');
addGames(vitaGames, 'PS Vita');
addGames(pspGames, 'PSP');

// Update total count
gameDatabase._metadata.totalGames = Object.keys(gameDatabase.games).length;

// Write to file
const outputPath = path.join(__dirname, '..', 'data', 'gameDatabase.json');
fs.writeFileSync(outputPath, JSON.stringify(gameDatabase, null, 2), 'utf8');

console.log(`✅ Game database generated successfully!`);
console.log(`📊 Total games: ${gameDatabase._metadata.totalGames}`);
console.log(`📁 File: ${outputPath}`);
console.log(`💾 Size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
