//設定画面→ゲーム画面の切り替え/ゲーム開始の処理

const form = document.querySelector('#form')
form.addEventListener('submit', (event) =>
    event.preventDefault()
);

const btn = document.querySelector('#start-button')
const startScreen = document.querySelector('#start-screen')
const gameScreen = document.querySelector('#game-screen')
const resultsScreen = document.querySelector('#results-screen')
const delayScreens = document.querySelectorAll('.delay-screen')

console.log(delayScreens)

const startGame = () => {
    //startScreenの非表示
    startScreen.style.display = 'none';
    //gameScreenの表示
    gameScreen.style.display = 'block';
    //問題欄、回答欄の遅延出現
    const keyframes = [
        {opacity: 0, transform: 'scale(0)'},
        {transform: 'scale(0.2)', offset: 0.2},
        {opacity: 1}
    ];
    const options = {
        duration: 250,
        delay: 500,
        fill: 'forwards',
    }

    for(const screen of delayScreens){
        screen.animate(keyframes, options);
    }
}

btn.addEventListener('click', startGame);

