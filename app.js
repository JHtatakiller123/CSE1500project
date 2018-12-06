var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var websocket = require("ws");
var port = process.argv[2];
var server = http.createServer(app);


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
const wss = new websocket.Server({ server })
var websockets = {};

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

app.get("/", (req, res) => {
  res.render("index.ejs", { gamesInitialized: gameStatus.gamesInitialized, gamesCompleted: gameStatus.gamesCompleted });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

setInterval(function() {
  for(let i in websockets){
      if(websockets.hasOwnProperty(i)){
          let gameObj = websockets[i];
          //if the gameObj has a final status, the game is complete/aborted
          if(gameObj.finalStatus!=null){
              console.log("\tDeleting element "+i);
              delete websockets[i];
          }
      }
  }
}, 50000);

var currentGame = new Game(gamStatus.gamesInitialized++)
var connectionId = 0;

wss.on("connection", function connection(ws) {

    /*
     * two-player game: every two players are added to the same game
     */
    let con = ws; 
    con.id = connectionID++;
    let playerType = currentGame.addPlayer(con);
    websockets[con.id] = currentGame;

    console.log("Player %s placed in game %s as %s", con.id, currentGame.id, playerType);

    /*
     * inform the client about its assigned player type
     */ 
    con.send((playerType == "A") ? messages.S_PLAYER_A : messages.S_PLAYER_B);


    /*
     * once we have two players, there is no way back; 
     * a new game object is created;
     * if a player now leaves, the game is aborted (player is not preplaced)
     */ 
    if (currentGame.hasTwoConnectedPlayers()) {
        currentGame = new Game(gameStatus.gamesInitialized++);
    }

  
  });

  con.on("close", function (code) {
        
    /*
     * code 1001 means almost always closing initiated by the client;
     * source: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
     */
    console.log(con.id + " disconnected ...");

    if (code == "1001") {
        /*
        * if possible, abort the game; if not, the game is already completed
        */
        let gameObj = websockets[con.id];

        if (gameObj.isValidTransition(gameObj.gameState, "ABORTED")) {
            gameObj.setStatus("ABORTED"); 
            gameStatus.gamesAborted++;

            /*
             * determine whose connection remains open;
             * close it
             */
            try {
                gameObj.playerA.close();
                gameObj.playerA = null;
            }
            catch(e){
                console.log("Player A closing: "+ e);
            }

            try {
                gameObj.playerB.close(); 
                gameObj.playerB = null;
            }
            catch(e){
                console.log("Player B closing: " + e);
            }                
        }
        
    }
});

server.listen(port);

