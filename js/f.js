import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { fc } from "./c.js";
import {
  getDoc,
  doc,
  arrayUnion,
  runTransaction,
  increment,
  getFirestore,
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { fetchTime } from "./index.js";
const app = initializeApp(fc);
const db = getFirestore(app);
const auth = getAuth();
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", (e) => {
  signOut(auth)
    .then(() => {
      //logout
    })
    .catch((error) => {
      alert(error);
    });
});
onAuthStateChanged(auth, (user) => {
  if (user) {
    const uid = user.uid;
    //showUserEmail(user.email);
    loadUserData(user.email);
  } else {
    window.location = "login.html";
  }
});

async function loadUserData(email) {
  const ref = doc(db, "users", email);
  const docSnap = await getDoc(ref);
  if (docSnap.exists()) {
    let data = docSnap.data();
    if (data.active == false) activateDealer(email, data.name);
    showUserCredits(data.name, data.credit);
    showDrawTbody(email);
    document.getElementById(
      "wp-msg"
    ).href = `https://wa.me/917903470243?text=${email}%20here`;
  }
}

function showUserCredits(name, credit) {
  document.getElementById("profile-name").textContent = name;
  document.getElementById("user-credit").textContent = credit;
}

async function calcDrawTime() {
  const t22 = await fetchTime();
  let date = t22.date,
    time = t22.time,
    min = t22.min,
    gameHr = t22.hr,
    sec = t22.sec,
    ampm = t22.ampm;
  let gameMin = Math.ceil(min / 15) * 15;
  if (min == 0 || min == 15 || min == 30 || min == 45) gameMin += 15;
  if (gameMin == 60 && gameHr != 12) {
    gameMin = 0;
    gameHr++;
  } else if (gameMin == 60 && gameHr == 12) {
    gameMin = 0;
    gameHr = 1;
  }
  let drawTime;
  if (gameHr == 12 && gameMin == 0) {
    if (ampm == "AM") ampm = "PM";
    else if (ampm == "PM") ampm = "AM";
  }

  if (
    (gameHr < 9 && ampm == "AM") ||
    (gameHr > 9 && ampm == "PM" && gameHr != 12) ||
    (gameHr == 9 && gameMin > 0 && ampm == "PM" && gameHr != 12) ||
    (gameHr == 12 && ampm == "AM")
  )
    drawTime = "9:0 AM";
  else drawTime = gameHr + ":" + gameMin + " " + ampm;
  return { date, drawTime, time, gameMin, gameHr, ampm, min, sec };
}

async function showDrawTbody(email) {
  const { date, drawTime } = await calcDrawTime();

  const ref = doc(db, "users", email, "game", date);
  const docSnap = await getDoc(ref);
  if (docSnap.exists()) {
    let gameData = docSnap.data()[drawTime];

    drawTbody(gameData);
  }
}

function drawTbody(data) {
  document.getElementById("game-draw-tbody").innerHTML = "";
  let keys = Object.keys(data);
  keys.forEach((i) => {
    let rowData = "";
    let ndata = data[i];
    rowData +=
      `<tr class="white-card">
    <td><strong>` +
      i +
      `</strong></td>
    <td><span style="margin-left: 20px">`;

    if (ndata != undefined) {
      ndata.forEach((n) => {
        rowData += n.amt + " + ";
      });
    }
    document.getElementById("game-draw-tbody").innerHTML +=
      rowData + `</span></td></tr>`;
  });
}

let betClicked = false;
//game - bet clicked
async function play(email, number, amount) {
  betClicked = true;
  let { date, drawTime, time, gameMin, gameHr, ampm, min, sec } =
    await calcDrawTime();
  const ref = doc(db, "users", email);
  const docSnap = await getDoc(ref);
  if (docSnap.exists()) {
    let data = docSnap.data();
    if (amount <= data.credit) {
      /*if (
        (gameHr > 9 && ampm == "PM" && gameHr != 12) ||
        (gameHr == 9 && gameMin > 0 && ampm == "PM" && gameHr != 12) ||
        (gameHr == 12 && ampm == "AM")
      ) {
        alert("Game Closed");
        betClicked = false;
        return;
      }*/
      // else drawTime = gameHr + ":" + gameMin + " " + ampm; */

      /* if (
        (min % 10 == 59 && sec >= 55) ||
        (min % 10 == 14 && sec >= 55) ||
        (min % 10 == 29 && sec >= 55) ||
        (min % 10 == 44 && sec >= 55)
      ) {
        alert("Time UP");
        window.location = "/";
        return;
      } */

      try {
        await runTransaction(db, async (transaction) => {
          const gamesDateDoc = await transaction.get(doc(db, "games", date));
          const gamesDealerDoc = await transaction.get(
            doc(db, "users", email, "game", date)
          );
          if (!gamesDateDoc.exists()) {
            transaction.set(doc(db, "games", date), {});
          }

          if (!gamesDealerDoc.exists()) {
            transaction.set(doc(db, "users", email, "game", date), {});
            transaction.set(doc(db, "users", email, "game", date), {});
          }

          transaction.update(
            doc(db, "games", date),
            {
              [`${drawTime}.${number}`]: arrayUnion({
                amt: amount,

                time: time + " " + ampm,
                email: email,
              }),
            },
            { merge: true }
          );

          transaction.update(doc(db, "users", email), {
            credit: increment(-1 * amount),
          });
          transaction.update(
            doc(db, "users", email, "game", date),
            {
              [`${drawTime}.${number}`]: arrayUnion({
                time: time + " " + ampm,
                amt: amount,
              }),
            },
            { merge: true }
          );
        });
      } catch (e) {
        console.error(e);
        alert("error ! " + e);
      }

      betClicked = false;
      //window.location = "/";
      document.getElementById("bet-amt").value = 0;
      await showDrawTbody(email);
    } else {
      alert(`Insufficient balance`);
    }
  }
}

const btn = document.getElementById("btn-submit");
btn.addEventListener("click", async (e) => {
  if (betClicked === true) return;
  btn.className = "btn-orange";

  const bet_amt = Number(document.getElementById("bet-amt").value);
  let bet_no;
  let ele = document.getElementsByName("scrip");
  for (let i = 0; i < ele.length; i++) {
    if (ele[i].checked) bet_no = ele[i].value;
  }
  if (bet_amt >= 10) {
    const email = auth.currentUser.email;
    await play(email, bet_no, bet_amt);
    const ref = doc(db, "users", email);
    const docSnap = await getDoc(ref);
    if (docSnap.exists()) {
      let data = docSnap.data();
      showUserCredits(data.name, data.credit);
    }
    btn.className = "btn-plum";
  } else {
    alert("10 credit required");
    document.getElementById("bet-amt").value = 0;
    btn.className = "btn-plum";
    //betClicked = false;
  }
});

async function activateDealer(email, name) {
  try {
    await runTransaction(db, async (transaction) => {
      transaction.update(doc(db, "users", email), {
        active: true,
      });
      transaction.set(doc(db, "users", email), {
        credit: 10000,
        name: name,
      });

      transaction.set(doc(db, "users", email, "game", "0"), {});

      console.log("Activation Success");
    });
  } catch (e) {
    alert("Activation Failed");
    console.error(e);
  }
}
