// server.js
// where your node app starts

// init project
const { fetchTideTimes } = require('./server/fetchTideTimes.js');
const { fetchWeatherAndSolarData } = require('./server/fetchWeatherAndSolarData.js');
const { insertAPIdata } = require('./server/insertAPIdata.js');
const { checkDays } = require('./server/checkDays.js');
const { insertDummyData } = require('./server/insertDummyData.js');
const { createTable } = require('./server/createTable.js');
const { checkTableExists } = require('./server/checkTableExists.js');
const { selectLatestTideTimes, selectLatestWeatherAndSolarData } = require('./server/selectStatements.js');

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const fs = require("fs");
const path = require("path");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));    // http://expressjs.com/en/starter/static-files.html

// we've started you off with Express,
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// ============================================================================

// Ensure the .data directory exists
const dataDir = path.join(__dirname, './server/.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`Created directory: ${dataDir}`);
}

// init sqlite db
const dbFile = "./server/.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);

// if ./server/.data/sqlite.db does not exist, create it, otherwise print records to console
// Check if the database file exists and handle table creation
db.serialize(() => {

  const initializeDatabase = async (tableName, sampleData) => {
    const exists = await checkTableExists(db, tableName);
    if (!exists) {
      await createTable(db, tableName);
      await insertDummyData(db, tableName, [sampleData, 1672578061000]);
    } else {
      console.log(`Table ${tableName} already exists.`);
    }
  };
  
  initializeDatabase("TideTimes", `{"data":[{"height":0,"time":"0000-01-01T00:00:00+00:00","type":"low"}]}`).catch(err => console.error("Initialization error:", err));
  initializeDatabase("WeatherData", `{"hours":[{"time":"2024-09-08T00:00:00+00:00","waterTemperature":{"noaa":16.25,"sg":16.25},"waveHeight":{"meteo":1.29,"noaa":1.77,"sg":1.29},"windDirection":{"noaa":355.46,"sg":355.46},"windSpeed":{"noaa":11.02,"sg":11.02},"gust": {"noaa": 13.26,"sg": 13.26},"pressure": {"noaa": 1011.93,"sg": 1011.93}}]}`).catch(err => console.error("Initialization error:", err));
  initializeDatabase("SolarData", `{"hours":[{"time":"2024-08-29T00:00:00+00:00","uvIndex":{"noaa":0,"sg":0}}]}`).catch(err => console.error("Initialization error:", err));
});

app.get("/", (request, response) => {
  response.sendFile(`${__dirname}/views/index.html`);
});

// ============================================================================

// define tideTimesDBquery endpoint
app.get("/tideTimesDBquery", async (request, response) => {
  console.log("tideTimesDBquery internal server endpoint received get request");
  try {
    const tideTimesObjectString = await selectLatestTideTimes(db);
    if (!tideTimesObjectString) {
      return response.status(404).json({ error: "No data found" });
    }

    const tideTimesObject = JSON.parse(tideTimesObjectString);
    response.json(tideTimesObject);
  } catch (err) {
    console.error("Database error:", err);
    response.status(500).json({ error: "Database error" });
  }
});

// define weatherAndSolarDBquery endpoint
app.get("/weatherAndSolarDBquery", async (request, response) => {
  console.log("weatherAndSolarDBquery internal server endpoint received get request");
  try {
    const { weatherData, solarData } = await selectLatestWeatherAndSolarData(db);
    if (!weatherData && !solarData) {
      return response.status(404).json({ error: "No data found" });
    }

    response.json({
      weatherData,
      solarData
    });
  } catch (err) {
    console.error("Database error:", err);
    response.status(500).json({ error: "Database error" });
  }
});

// ============================================================================

// Endpoint for fetchTideTimes (API call) and insertion of API data into the SQLite database
app.get('/fetchTideTimes', async (req, res) => {
  console.log('GET request reached the internal server side endpoint: fetchTideTimes');

  try {
    // 1. Check if more than x number of days have passed since the last tide times table entry
    const numberOfDays = 1;   // Specify number of days in rate limiting function
    console.log(`Checking if more than ${numberOfDays} number of day(s) have passed since the last tide times table entry`)
    const canCallAPI = await checkDays(db, "TideTimes", numberOfDays); // Pass the database connection to checkDays() along with number of days to check
    console.log(
      `It has been ${canCallAPI.daysDifference} days since last tide times API call. 
      Consequently, will the API call proceed?: ${canCallAPI.canProceed}`);
    if (!canCallAPI.canProceed) {
      return res.status(429).json({ message: `API call not allowed. Last entry was less than ${numberOfDays} day(s) ago.` });
    }

    // 2. Make the API call to get tide times (fetchTideTimes.js)
    const tideTimesData = await fetchTideTimes(); // Await the result of the API call
    const apiData = JSON.stringify(tideTimesData)
    console.log("fetchTideTimes() returns: " + apiData); // Log the resolved value

    // 3. Cleanse the data (cleanseString())
    // const cleansedAPIdata = cleanseString(req.body.APIdata);
    // const apiData = cleanseString(req.body.APIdata);

    // const { username } = req.body; // Assuming you're also inserting the username

    // 4. Insert the APIdata into the database (insertAPIcallData.js)
    const result = await insertAPIdata(db, "TideTimes", apiData); // Await the insertion result
    console.log("API data inserted successfully:", result);

    // 5. Send a response back to the client
    res.status(201).json({ message: "Data inserted successfully", result });
  } catch (error) {
    console.error("Error in processing:", error);
    // 6. Handle the error appropriately
    res.status(500).json({ error: error.message });
  }
});


// Endpoint for fetchWeatherAndSolarData (API call) and insertion of API data into the SQLite database
app.get('/fetchWeatherAndSolarData', async (req, res) => {
  console.log('GET request reached the internal server side endpoint: fetchWeatherAndSolarData');

  try {
    // 1. Check if more than x number of days have passed since the last weather data table entry
    const numberOfDays = 1;   // Specify number of days in rate limiting function
    console.log(`Checking if more than ${numberOfDays} number of day(s) have passed since the weather data table entry`)
    const canCallAPI = await checkDays(db, "WeatherData", numberOfDays); // Pass the database connection to checkDays() along with number of days to check
    console.log(
      `It has been ${canCallAPI.daysDifference} days since last weather data API call. 
      Consequently, will the API call proceed?: ${canCallAPI.canProceed}`);
    if (!canCallAPI.canProceed) {
      return res.status(429).json({ message: `API call not allowed. Last entry was less than ${numberOfDays} day(s) ago.` });
    }

    // 2. Make the API call to get weather data (fetchWeatherAndSolarData.js)
    const getResponse = await fetchWeatherAndSolarData(); // Await the result of the API call
    const theWeatherData = JSON.stringify(getResponse.weatherData);
    const theSolarData = JSON.stringify(getResponse.solarData);
    
    console.log("weather data returns: " + theWeatherData); // Log the resolved value
    console.log("solar data returns: " + theSolarData); // Log the resolved value

    // 3. Cleanse the data (cleanseString())
    // const cleansedAPIdata = cleanseString(req.body.APIdata);
    // const apiData = cleanseString(req.body.APIdata);

    // const { username } = req.body; // Assuming you're also inserting the username

    // 4.1 Insert the weather APIdata into the database (insertAPIcallData.js)
    const weatherDataInsertionResult = await insertAPIdata(db, "WeatherData", theWeatherData); // Await the insertion result
    console.log("weather API data inserted successfully:", weatherDataInsertionResult);
    // 4.2 Insert the weather APIdata into the database (insertAPIcallData.js)
    const solarDataInsertionResult = await insertAPIdata(db, "SolarData", theSolarData); // Await the insertion result
    console.log("weather API data inserted successfully:", solarDataInsertionResult);

    // 5. Send a response back to the client
    res.status(201).json({ message: "Data inserted successfully", weatherDataInsertionResult, solarDataInsertionResult });
  } catch (error) {
    console.error("Error in processing:", error);
    // 6. Handle the error appropriately
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================

// // endpoint to clear tideTimesObject from the database
// app.get("/clearDOM", (request, response) => {
//   // DISALLOW_WRITE is an ENV variable that gets reset for new projects so you can write to the database
//   if (!process.env.DISALLOW_WRITE) {
//     db.each(
//       "SELECT * from TideTimes",
//       (err, row) => {
//         console.log("row", row);
//         db.run(`DELETE FROM TideTimes WHERE ID=?`, row.id, error => {
//           if (row) {
//             console.log(`deleted row ${row.id}`);
//           }
//         });
//       },
//       err => {
//         if (err) {
//           response.send({ message: "error!" });
//         } else {
//           response.send({ message: "success" });
//         }
//       }
//     );
//   }
// });

// Cleanse the API call data - ADD THIS LATER!
// helper function that prevents html/css/script malice
// const cleanseString = function(string) {
//   return string.replace(/</g, "&lt;").replace(/>/g, "&gt;");
// };

// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});