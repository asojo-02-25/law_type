//設定画面→ゲーム画面の切り替え

const btn = document.querySelector('#start-button')
const startScreen = document.querySelector('#start-screen')
const gameScreen = document.querySelector('#game-screen')
const resultsScreen = document.querySelector('#results-screen')

btn.addEventListener('click', startGame);
function startGame(){
    //startScreenの非表示
    startScreen.style.display = 'none';
    //gameScreenの表示
    gameScreen.style.display = 'block';
}
