const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

const getState = (OBJ) => {
  return {
    stateId: OBJ.state_id,
    stateName: OBJ.state_name,
    population: OBJ.population,
  };
};

const getDistrict = (obj) => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
};

let db = null;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const InitializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started at http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB Error : ${error.message}`);
    process.exit(1);
  }
};

InitializeDBAndServer();

const authenticateToken = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "97000", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// login

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const userCheckQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbRes = await db.get(userCheckQuery);
  if (dbRes === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbRes.password);
    if (isPasswordMatched) {
      const payload = { username };
      const jwtToken = await jwt.sign(password, "97000");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// list of all states

app.get("/states/", authenticateToken, async (request, response) => {
  const ALlTablesQuery = `SELECT * FROM state;`;
  const dbRes = await db.all(ALlTablesQuery);
  result = dbRes.map(getState);
  response.send(result);
});

// state based on state id
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const ALlTablesQuery = `SELECT * FROM state WHERE state_id = '${stateId}';`;
  const dbRes = await db.get(ALlTablesQuery);
  const result = getState(dbRes);
  response.send(result);
});

//create district in district table

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
     VALUES('${districtName}',
     ${stateId},
     ${cases},
     ${cured},
     ${active},
     ${deaths}
     );`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

// Get district with districtId

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQ = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const DbRes = await db.get(getDistrictQ);
    const result = getDistrict(DbRes);
    response.send(result);
  }
);

//delete district
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQ = `DELETE FROM district WHERE district_id = ${districtId};`;
    const DbRes = await db.run(getDistrictQ);
    response.send("District Removed");
  }
);

//update district
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const UpdateDistrictQ = `UPDATE district SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
     WHERE district_id = ${districtId};`;
    await db.run(UpdateDistrictQ);
    response.send("District Details Updated");
  }
);

// state cases stats

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `SELECT 
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM
    state NATURAL JOIN district 
    WHERE 
    state_id = ${stateId};`;
    const dbRes = await db.get(getStatsQuery);
    response.send(dbRes);
  }
);

module.exports = app;
