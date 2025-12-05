//設定画面→ゲーム画面の切り替え&ゲーム開始の処理

const form = document.querySelector('#form')
const startScreen = document.querySelector('#start-screen')
const gameScreen = document.querySelector('#game-screen')
const resultsScreen = document.querySelector('#results-screen')
const delayScreens = document.querySelectorAll('.delay-screen')
const btn = document.querySelector('#start-button')

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

//ゲーム開始の処理
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
        {opacity: 1, transform: 'scale(1)'},
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

//フォーム提出時→ゲーム開始のイベントリスナー
form.addEventListener('submit', (event) => {
    console.log("フォームが提出されました");
    event.preventDefault();
    const currentSettings = getGameSettings()
    startGame(currentSettings);
});

//Space,Escキー押下時の処理

const resetGame = () => {
    //画面の切り替え
    gameScreen.style.display = 'none';
    startScreen.style.display = 'block';
    //アニメーションのリセット
    for(const screen of delayScreens){
        //スタイルの不透明度とサイズを復元
        screen.style.opacity = '0';
        screen.style.transform = 'scale(0)';
        //アニメーションの解除
        screen.getAnimations().forEach((animation) => {
            animation.cancel();
        });
    }

    // 将来的にゲームのタイマー等をリセットする処理を記述する必要有
}

document.addEventListener('keydown', (event) => {
    //スペースキー押下時もフォーム提出と同様の処理を行う
    if(event.code === 'Space' && startScreen.style.display !== 'none'){
        event.preventDefault();
        btn.click();
    }
    //Escキー押下時にゲーム中断
    if(event.code === 'Escape' && gameScreen !== 'none'){
        event.preventDefault();
        resetGame();
    }
});





