// スタートボタンにマウスが重なったときにボタンを大きくする
const btn = document.querySelector('#start-button')

btn.addEventListener('mouseover', () => {
    btn.animate(
        {
            
        },
        {
            duration: .2
        }
    );
});

//設定画面→ゲーム画面の切り替え


