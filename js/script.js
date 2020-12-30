'use strict';

//по ссылке передаем сложность - 0,1,2
const difficulty = +location.href.split('?')[1].split('=')[1];
var game;
var timer = false;
var startTime;

//главный класс, который будет хранить все данные об игре
class Minesweeper {
  constructor(options = {}) {

    let loadedData = {};
  
    //проверяем есть ли хранилище и данные в нем
    //если да, то записываем их в переменную loadedData 
    if (hassessionStorage && sessionStorage["minesweeper.data"]) {
      loadedData = JSON.parse(sessionStorage["minesweeper.data"]);
    }
  
      Object.assign(
        this, {
          board: [], //хранит массив объектов клетка (Cell)
          detected: 0, //количество корректно отмеченных мин
          mistaken: 0, //количество некорректно отмеченных мин
          status_msg: "Playing", //статус игры - идет игра, вы проиграли, вы выиграли
          playing: true,
          moves: 0, //количество сделанных ходов
          settings: {
            rows: 8, //количество рядов, авто 8
            columns: 10, //количество колонок, авто 10
            mines: 10 //количество мин, авто 10
          }
        }, { settings: options }, loadedData
      );
  
      //в зависимости от сложности устанавливаем количество рядов, колонок и мин
      if (difficulty === 0) {
        this.settings["rows"] = 8;
        this.settings["columns"] = 10;
        this.settings["mines"] = 10;
      } else if (difficulty === 1)  {
        this.settings["rows"] = 14;
        this.settings["columns"] = 18;
        this.settings["mines"] = 40;
      } else if (difficulty === 2)  {
        this.settings["rows"] = 20;
        this.settings["columns"] = 24;
        this.settings["mines"] = 99;
      }
  
      //инициализируем новую игру и сохраняем
      this.initialise();
      this.save();
    }
  
    //функция инициализации, выполняется при запуске новой игры
    initialise() {

    //заполняем двумерный массив экземплярами класса Клетка с координатами (с, r)
      for (let r = 0; r < this.settings["rows"]; r++) {
        this.board[r] = [];
        for (let c = 0; c < this.settings["columns"]; c++) {
          this.board[r].push(new Cell({ x: c, y: r }));
        }
      }
  
      //случайным образом распологаем мины
      let assignedMines = 0;
      while (assignedMines < this.settings.mines) {
        var rIndex = Math.floor(Math.random() * this.settings.rows);
        var cIndex = Math.floor(Math.random() * this.settings.columns);
        let cell = this.board[rIndex][cIndex];
        if (!cell.isMine) {
          cell.isMine = true;
          cell.value = "M";
          assignedMines++;
        }
      }
  
      //считаем "значение" каждой клетки по количиству мин, которые с ней  смежные
      for (let r = 0; r < this.settings["rows"]; r++) {
        for (let c = 0; c < this.settings["columns"]; c++) {
          if (!this.board[r][c].isMine) {
            let counter = 0;
            let adjCells = this.getAdjacentCells(r, c);
            for (let i = adjCells.length; i--; ) {
              if (adjCells[i].isMine) {
                counter++;
              }
            }
  
            this.board[r][c].value = counter;
          }
        }
      }

      //после инициализации всегда необходимо взаимодействие с DOM
      this.render();
    }
  
    
    //взаимодействие с DOM
    render() {

      //идентификатор для css
      document.getElementsByClassName("content")[0].setAttribute("id", `difficulty${difficulty}`); 
      
      //изначально этот контейнер пустой, то есть до этого момента в HTML не было информаци
      //про ряды, клетки и их внутреннее состояние
      //динамически заполняем его 
      const gameContainer = document.getElementById("game_container");
      gameContainer.innerHTML = "";
  
      let content = "";
      for (let r = 0; r < this.settings.rows; r++) {
        content += '<div class="row">';
        for (let c = 0; c < this.settings.columns; c++) {
          let cell = this.board[r][c];
  

          let add_class = "";
          let txt = "";
          if (cell.isFlagged) {
            add_class = "flagged";
          } else if (cell.isRevealed) {
            add_class = `revealed adj-${cell.value}`;
            txt = (!cell.isMine ? cell.value || "" : "");
          }
          
          //разделение на четные/нечетные необходимо только для графических целей
          if ( (c + r) % 2 === 0) {
            content += `<div class="cell ${add_class}" id="cell0" data-x="${c}" data-y="${r}">${txt}</div>`;
          } else {
            content += `<div class="cell ${add_class}" id="cell1" data-x="${c}" data-y="${r}">${txt}</div>`;
          }
        }
        content += "</div>";
      }
  
      gameContainer.innerHTML = content;
  
      //обновляем дефолтные данные на инициализированные
      document.getElementById("rows").value = this.settings["rows"];
      document.getElementById("columns").value = this.settings["columns"];
      document.getElementById("mines").value = this.settings["mines"];
      document.getElementById("mine_count").textContent =
        this.settings["mines"] - (this.mistaken + this.detected);
      document.getElementById("moves_made").textContent = this.moves;
      document.getElementById("game_status").textContent = this.status_msg;
    }
  
    //получаем смежные клетки 
    getAdjacentCells(row, col) {
      let res = [];
      for ( let rowPos = row > 0 ? -1 : 0;
          rowPos <= (row < this.settings.rows - 1 ? 1 : 0); rowPos++) {
        for ( let colPos = col > 0 ? -1 : 0;
          colPos <= (col < this.settings.columns - 1 ? 1 : 0); colPos++ ) {
            res.push(this.board[row + rowPos][col + colPos]); 
        }
      }
      return res;
      
    }
  
    //контролирует происходящее, после того как клетка открыта 
    revealCell(cell) {

      //при первом ходе запускаем таймер
      if (!timer) this.startTimer();

      //если клетка еще не открыта и не отмечена
      if (!cell.isRevealed && !cell.isFlagged && this.playing) {
        const cellElement = cell.getElement();

        if (parseInt(document.getElementById("moves_made").textContent, 10) === 1 && cell.isMine) {
            timer = false;
            sessionStorage.clear();
            newGame();
        }
  
        //к классам клетки добавляется "revealed" и "adj-значение" 
        cell.isRevealed = true;
        cellElement.classList.add("revealed", `adj-${cell.value}`);
        cellElement.textContent = (!cell.isMine ? cell.value || "" : "");
        this.validate();
  
        //если клетка оказалось миной - игра заканчивается
        if (cell.isMine && parseInt(document.getElementById("moves_made").textContent, 10) !== 0) {
          //обеспечение безопасного первого хода 
          //если при первом нажатии попасть на мину, происойдет переинициализация
          this.show();
          timer = false;
          this.status_msg = "Sorry, you lost!";
          this.playing = false;
          document.getElementById("game_status").textContent = this.status_msg;
        } else if (!cell.isFlagged && cell.value == 0) {
          //если значение клетки оказалось равно 0, запускаем рекурсию,
          //чтобы открыть и смежные с ней клетки
          const adjCells = this.getAdjacentCells(cell.y, cell.x);
          for (let i = 0, j = adjCells.length; i < j; i++) {
            this.revealCell(adjCells[i]);
            this.validate();
          }
        }
      }
    }

    //когда игра окончена, функция открывает расположение всех бомб
    show() {
      for (let r = 0; r < this.settings["rows"]; r++) {
        for (let c = 0; c < this.settings["columns"]; c++) {
          if (this.board[r][c].isMine && parseInt(document.getElementById("moves_made").textContent, 10) !== 0) {
            this.revealCell(this.board[r][c]);
          }
        }
      } 
    }
  
    //отметить клетку
    flagCell(cell) {
      if (!cell.isRevealed && this.playing) {
        const cellElement = cell.getElement();
        const mineCount = document.getElementById("mine_count");
  
        if (!cell.isFlagged) {
          cell.isFlagged = true;
          cellElement.classList.add("flagged");
          mineCount.textContent = parseFloat(mineCount.textContent) - 1;
          if (cell.isMine) {
            this.detected++;
          } else {
            this.mistaken++;
          }
          this.validate();
        } else {
          cell.isFlagged = false;
          cellElement.classList.remove("flagged");
          cellElement.textContent = "";
          mineCount.textContent = parseFloat(mineCount.textContent) + 1;
          if (cell.isMine) {
            this.detected--;
          } else {
            this.mistaken--;
          }
        }
      }
    }

    //изменение статуса игры
    validate() {
      const gameStatus = document.getElementById("game_status");
      if (this.detected === this.settings.mines && this.mistaken === 0) {
        this.status_msg = "You won!";
        this.playing = false;
        gameStatus.textContent = this.status_msg;
      } else {
        this.status_msg = "Playing";
        this.playing = true;
        gameStatus.textContent = this.status_msg;
      }
      this.save();
    }

    //управление таймером
    countInterval() {
      setInterval(function() { 
        let elt = document.getElementById("timer");
        if (timer) {
          let now = new Date();
          let secs = Math.floor((now.getTime() - startTime.getTime())/1000);
          elt.innerHTML = (secs > 999 ? charInfinity : "" + secs);
        } 
      }, 1000);
    }

    startTimer() {
      startTime = new Date();
      timer = true;
      this.countInterval();
    }



    //сохранение данных в хранилище
    save() {
      if (!hassessionStorage) {
        return false;
      } else {
        let data = JSON.stringify(this);
        sessionStorage["minesweeper.data"] = data;
      }
    }
  }
  
  //класс Клетка, который содержит информацию о внутренних состояниях
  class Cell {
    constructor({
      x,//координата х - столбик
      y,//координата у - ряд
      value = 0,//значение - М-мина, F-отмечена, цифра - количество бомб в смежных клетках 
      isMine = false,//мина или нет
      isRevealed = false,//открыта или нет
      isFlagged = false//отмечена или нет
    }) {
      Object.assign(this, {
        x,
        y,
        value, 
        isMine,
        isRevealed,
        isFlagged
      });
    }


    //получить клетку
    getElement() {
      return document.querySelector(`.cell[data-x="${this.x}"][data-y="${this.y}"]`);
    }

  }
  
  //создание новой игры/экземпляра класса Minesweeper
  function newGame(options = {}) {
    game = new Minesweeper(options);
  }

//функционал при загрузке страницы 
window.onload = function() {    

  //создание игры при загрузке
  const options = {
    rows: parseInt(document.getElementById("rows").value, 10),
    columns: parseInt(document.getElementById("columns").value, 10),
    mines: parseInt(document.getElementById("mines").value, 10)
  };
  
  if (hassessionStorage) sessionStorage.clear();
  newGame(options);

  //при нажатии на кнопку new game создается новая игра
  document.getElementById("new_game_button").addEventListener("click", function() {  
    if (hassessionStorage) {
      sessionStorage.clear();
    }
    newGame(options);
  });
  
  //нажатие на левую кнопку - клетка открыта
  document.getElementById("game_container").addEventListener("click", function(e) { 
    const target = e.target;
    if (target.classList.contains("cell")) {
    const cell = game.board[target.getAttribute("data-y")][target.getAttribute("data-x")];
      if (!cell.isRevealed && game.playing) {
        game.moves++;
        document.getElementById("moves_made").textContent = game.moves;
        game.revealCell(cell);
        game.save();
      }
    }
  });
  
  //нажатие на правую кнопку - клетка отмечена
  document.getElementById("game_container").addEventListener("contextmenu", function(e) {
      
    e.preventDefault();
    const target = e.target;
    if (target.classList.contains("cell")) {
      const cell = game.board[target.getAttribute("data-y")][target.getAttribute("data-x")];
      if (!cell.isRevealed && game.playing) {
        game.moves++;
        document.getElementById("moves_made").textContent = game.moves;
        game.flagCell(cell);
        game.save();
      }
    }
  });
    
  //создать новую игру
  newGame();
};
  
//хранилище  
const hassessionStorage = (function() {
  try {
    return "sessionStorage" in window && window["sessionStorage"] !== null;
  } catch (e) {
    return false; 
  }
})();