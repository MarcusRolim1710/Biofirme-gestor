document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  function getAnim() { return window.BiofirmAnimations; }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var Anim = getAnim();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
      if (Anim) Anim.shakeLoginCard();
      // feedback visual rápido no campo vazio
      var shakeTarget = !username ? document.getElementById('username') : document.getElementById('password');
      if (shakeTarget && typeof gsap !== 'undefined' && Anim && Anim.prefersReducedMotion && !Anim.prefersReducedMotion()) {
        gsap.killTweensOf(shakeTarget);
        gsap.timeline().to(shakeTarget, { x: -6, duration: 0.07 }).to(shakeTarget, { x: 6, duration: 0.07 }).to(shakeTarget, { x: 0, duration: 0.1 });
      }
      alert('Preencha usuário e senha.');
      return;
    }

    const email = username.includes('@') ? username : `${username}@biofirm.local`;

    if (Anim) Anim.loginButtonLoading(true);
    try {
      const data = await login(email, password);
      sessionStorage.setItem('biofirm_user', JSON.stringify(data.user));
      // Transição de saída sutil antes de navegar - com guard defensivo
      if (typeof gsap !== 'undefined' && Anim && Anim.prefersReducedMotion && !Anim.prefersReducedMotion()) {
        var card = document.querySelector('.login-card');
        if (card) {
          gsap.to(card, { y: -12, autoAlpha: 0, duration: 0.35, ease: 'power2.in', onComplete: function(){ window.location.href = 'dashboard.html'; }});
          return;
        }
      }
      window.location.href = 'dashboard.html';
    } catch (err) {
      var AnimErr = getAnim();
      if (AnimErr) { AnimErr.loginButtonLoading(false); AnimErr.shakeLoginCard(); }
      alert(err.message || 'Erro de conexão com o banco de dados.');
    }
  });

  // Erro de campo: borda shake sutil com GSAP no blur inválido
  ['username','password'].forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('invalid', function(){
      var Anim = getAnim();
      if (Anim) Anim.shakeLoginCard();
    });
  });
});
