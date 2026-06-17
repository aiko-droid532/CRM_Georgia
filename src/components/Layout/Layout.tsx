'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const pathname = usePathname();

  const navItems = [
    { name: 'Аналитика', path: '/', icon: '📈' },
    { name: 'Управление клиентами', path: '/clients', icon: '👤' },
    { name: 'Сделки', path: '/deals', icon: '🤝' },
    { name: 'Шахматка', path: '/shakhmatka', icon: '🧱' },
    { name: 'Финансы', path: '/finance', icon: '💸' },
    { name: 'Отчеты', path: '/reports', icon: '📊' },
  ];


  return (
    <div className={styles.container}>
      {/* Компактный Верхний Меню Бар */}
      <nav className={styles.topNav}>
        <div className={styles.navLeft}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>💰</span>
            <span className={styles.logoText}>CRM</span>
          </div>
          <div className={styles.menuItems}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`${styles.navLink} ${pathname === item.path ? styles.active : ''}`}
              >
                <span className={styles.icon}>{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </div>
        </div>
        
        <div className={styles.navRight}>
          <div className={styles.searchBox}>
            <input type="text" placeholder="Поиск..." />
          </div>
          <div className={styles.userProfile}>
            <div className={styles.avatar}>АИ</div>
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
};

export default Layout;
