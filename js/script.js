//設定画面→ゲーム画面の切り替え&ゲーム開始の処理

const form = document.querySelector('#form')
const startScreen = document.querySelector('#start-screen')
const gameScreen = document.querySelector('#game-screen')
const resultsScreen = document.querySelector('#results-screen')
const delayScreens = document.querySelectorAll('.delay-screen')

//設定の取得
const getGameSettings = () => {
    //問題形式
    const format = document.querySelector('input[name="format"]:checked').value;
    //問題数
    const itemcounts = parseInt(document.querySelector('input[name="itemcounts"]:checked').value);
    //各種設定
    const options = []
    document.querySelectorAll('input[name="setting"]:checked').forEach((checkbox) => {
        options.push(checkbox.value);
    });

    return{
        mode: format,
        questionCounts: itemcounts,
        settings: options,
    }
};

const startGame = (config) => {
    console.log("開始設定", config)

    if(config.settings.includes('roman-letters-represent')){
        console.log("ローマ字を表示します");
    }
    if(config.settings.includes('keyboard-represent')){
        console.log("キーボードを表示します");
    }
    //ディスプレイ関連
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
};

form.addEventListener('submit', (event) => {
    console.log("フォームが提出されました");
    event.preventDefault();
    const currentSettings = getGameSettings()
    startGame(currentSettings);
});


