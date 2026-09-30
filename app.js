(() => {
  'use strict';
  const root = document.documentElement;
  const themeButton = document.querySelector('.theme-toggle');
  const navButton = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  const header = document.querySelector('.site-header');
  const systemTheme = window.matchMedia('(prefers-color-scheme: light)');
  let savedTheme;
  try { savedTheme = localStorage.getItem('qinghan-theme'); } catch { /* Use the system preference when storage is unavailable. */ }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeButton.setAttribute('aria-pressed', String(theme === 'light'));
    themeButton.setAttribute('aria-label', theme === 'light' ? '切换为深色主题' : '切换为浅色主题');
  }
  applyTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : (systemTheme.matches ? 'light' : 'dark'));
  themeButton.addEventListener('click', () => {
    savedTheme = root.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(savedTheme);
    try { localStorage.setItem('qinghan-theme', savedTheme); } catch { /* The current session still changes theme. */ }
  });
  systemTheme.addEventListener?.('change', (event) => {
    if (!savedTheme) applyTheme(event.matches ? 'light' : 'dark');
  });

  function closeMenu() {
    nav.classList.remove('open');
    navButton.setAttribute('aria-expanded', 'false');
    navButton.setAttribute('aria-label', '打开导航');
  }
  navButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    navButton.setAttribute('aria-expanded', String(open));
    navButton.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      closeMenu();
      navButton.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target) && !navButton.contains(event.target)) closeMenu();
  });
  window.matchMedia('(min-width: 821px)').addEventListener?.('change', (event) => {
    if (event.matches) closeMenu();
  });

  function updateHeader() { header.classList.toggle('scrolled', window.scrollY > 12); }
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
  document.querySelector('#year').textContent = new Date().getFullYear();

  const avatar = document.querySelector('.portrait-card img');
  function avatarFallback() { avatar.parentElement.classList.add('avatar-unavailable'); }
  avatar.addEventListener('error', avatarFallback);
  if (avatar.complete && avatar.naturalWidth === 0) avatarFallback();

  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.section-heading, .about-grid, .project-card, .now-card, blockquote, .contact h2, .contact-link').forEach((element) => {
      element.classList.add('reveal');
      observer.observe(element);
    });
  }
})();
