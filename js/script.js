//設定画面→ゲーム画面の切り替え/ゲーム開始の処理

const form = document.querySelector('#form')
form.addEventListener('submit', (event) =>
    event.preventDefault()
);

const btn = document.querySelector('#start-button')
const startScreen = document.querySelector('#start-screen')
const gameScreen = document.querySelector('#game-screen')
const resultsScreen = document.querySelector('#results-screen')

const startGame = () => {
    //startScreenの非表示
    startScreen.style.display = 'none';
    //gameScreenの表示
    gameScreen.style.display = 'block';
}

btn.addEventListener('click', startGame);

