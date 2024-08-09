// server.js
// where your node app starts

// init project
// import { handleApiButtonClick } from './api.js';   // Import the apiCall function
const { handleApiButtonClick } = require('./apiCall.js');
const { currentUnixTimestamp } = require('./currentUnixTimestamp.js');
const { insertAPIdata } = require('./insertAPIdata.js');

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const fs = require("fs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// we've started you off with Express,
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// init sqlite db
const dbFile = "./.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);

// if ./.data/sqlite.db does not exist, create it, otherwise print records to console
db.serialize(() => {
  if (!exists) {
    db.run(
      "CREATE TABLE BeachTable (id INTEGER PRIMARY KEY AUTOINCREMENT, weatherObject TEXT, time INTEGER)"
    );
    console.log("New table BeachTable created!");



    // Insert default weatherObject with the current timestamp
    db.serialize(() => {
      db.run(
        'INSERT INTO BeachTable (weatherObject, time) VALUES (?, ?), (?, ?), (?, ?)',
        ["Find and count some sheep", currentUnixTimestamp(),
          "Climb a really tall mountain", currentUnixTimestamp(),
          "Wash the dishes", currentUnixTimestamp()]
      );
    });
  } else {
    console.log('Table "BeachTable" ready to go!');
    db.each("SELECT * from BeachTable", (err, row) => {
      if (row) {
        console.log(`record: ${row.weatherObject}, added at: ${row.time}`);
      }
    });
  }
});


// http://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  response.sendFile(`${__dirname}/views/index.html`);
});

// endpoint to get all the weatherObjects in the database
app.get("/getData", (request, response) => {
  db.all("SELECT * from BeachTable", (err, rows) => {
    response.send(JSON.stringify(rows));
  });
});

// endpoint to add a weatherObject to the database
app.post("/addDream", (request, response) => {
  console.log(`add to weatherObject ${request.body.weatherObject}`);

  // DISALLOW_WRITE is an ENV variable that gets reset for new projects
  // so they can write to the database
  if (!process.env.DISALLOW_WRITE) {
    const cleansedDream = cleanseString(request.body.weatherObject);
    db.run(`INSERT INTO BeachTable (weatherObject, time) VALUES (?, ?)`, [cleansedDream, currentUnixTimestamp()], error => {
      if (error) {
        response.send({ message: "error!" });
      } else {
        response.send({ message: "success" });
      }
    });
  }
});

// Endpoint to insert API data into the SQLite database
app.get('/addAPIdata', async (req, res) => {
  console.log('GET request reached the internal server side endpoint');

  try {
    // 1. Make the API call (apiCall.js)
    const apiData = await handleApiButtonClick(); // Await the result of the API call
    console.log("handleApiButtonClick() returns: " + apiData); // Log the resolved value

    // 2. Cleanse the data (cleanseString())
    // const cleansedAPIdata = cleanseString(req.body.APIdata);
    // const apiData = cleanseString(req.body.APIdata);

    // const { username } = req.body; // Assuming you're also inserting the username

    // 3. Insert the APIdata into the database (insertAPIcallData.js)
    const result = await insertAPIdata(apiData); // Await the insertion result
    console.log("Data inserted successfully:", result);

    // Send a response back to the client
    res.status(201).json({ message: "Data inserted successfully", result });
  } catch (error) {
    console.error("Error in processing:", error);
    // Handle the error appropriately
    res.status(500).json({ error: error.message });
  }

});

// endpoint to clear weatherObject from the database
app.get("/clearDOM", (request, response) => {
  // DISALLOW_WRITE is an ENV variable that gets reset for new projects so you can write to the database
  if (!process.env.DISALLOW_WRITE) {
    db.each(
      "SELECT * from BeachTable",
      (err, row) => {
        console.log("row", row);
        db.run(`DELETE FROM BeachTable WHERE ID=?`, row.id, error => {
          if (row) {
            console.log(`deleted row ${row.id}`);
          }
        });
      },
      err => {
        if (err) {
          response.send({ message: "error!" });
        } else {
          response.send({ message: "success" });
        }
      }
    );
  }
});

// Cleanse the API call data - ADD THIS LATER!
// helper function that prevents html/css/script malice
// const cleanseString = function(string) {
//   return string.replace(/</g, "&lt;").replace(/>/g, "&gt;");
// };

// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});