// スタートボタンにマウスが重なったときにボタンを大きくする
const btn = document.querySelector('#start-button')

btn.addEventListener('mouseover', () => {
    btn.animate(
        {
            translate: []
        },
        {
            duration: .2
        }
    );
});


