import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  HomeIcon, 
  ArrowUpTrayIcon, 
  ScaleIcon,
  BanknotesIcon,
  UserCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  ArrowUpTrayIcon as ArrowUpTrayIconSolid,
  ScaleIcon as ScaleIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid
} from '@heroicons/react/24/solid';

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();

  // Only show Harmonisation if isInCouple is explicitly true
  const isInCouple = user?.isInCouple === true;
  const isAdmin = user?.isAdmin === true;

  // Base navigation items
  const baseNavigation = [
    { name: 'Accueil', href: '/dashboard', icon: HomeIcon, iconActive: HomeIconSolid },
    { name: 'Comptes', href: '/accounts', icon: BanknotesIcon, iconActive: BanknotesIconSolid },
    { name: 'Importer', href: '/import', icon: ArrowUpTrayIcon, iconActive: ArrowUpTrayIconSolid },
  ];

  // Add Harmonisation only if user is in a couple
  const navigation = isInCouple 
    ? [...baseNavigation, { name: 'Couple', href: '/harmonization', icon: ScaleIcon, iconActive: ScaleIconSolid }]
    : baseNavigation;

  // Add admin to navigation for admins
  const navigationWithAdmin = isAdmin 
    ? [...navigation, { name: 'Admin', href: '/admin', icon: ShieldCheckIcon, iconActive: ShieldCheckIconSolid }]
    : navigation;

  // Add profile to navigation for mobile
  const mobileNavigation = [
    ...navigationWithAdmin,
    { name: 'Profil', href: '/profile', icon: UserCircleIcon, iconActive: UserCircleIconSolid }
  ];

  const isActive = (href) => location.pathname === href;

  return (
    <>
      {/* Desktop Navigation - Top bar */}
      <nav className="hidden md:block bg-theme-card shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              {/* Logo */}
              <Link to="/dashboard" className="flex-shrink-0 flex items-center group">
                <img 
                  src="/logo.svg" 
                  alt="Prix du Coeur" 
                  className="h-12 w-12 transition-transform group-hover:scale-105 rounded-full"
                />
                <span className="ml-2 text-xl font-semibold text-pdc-dark-600 hidden lg:block">
                  Prix du Coeur
                </span>
              </Link>
              {/* Desktop navigation links */}
              <div className="ml-6 flex space-x-4 lg:space-x-8">
                {navigationWithAdmin.map((item) => {
                  const Icon = isActive(item.href) ? item.iconActive : item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isActive(item.href)
                          ? 'border-pdc-cyan text-pdc-cyan'
                          : 'border-transparent text-theme-tertiary hover:border-pdc-mint hover:text-pdc-dark-500'
                      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                    >
                      <Icon className="h-5 w-5 mr-1.5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            
            {/* Desktop user section */}
            <div className="flex items-center">
              <Link
                to="/profile"
                className="flex items-center hover:opacity-80 transition-opacity"
                title="Mon profil"
              >
                {user?.profilePictureUrl ? (
                  <img
                    src={user.profilePictureUrl}
                    alt="Photo de profil"
                    className="h-10 w-10 rounded-full object-cover border-2 border-pdc-cyan-300 hover:border-pdc-cyan transition-colors"
                  />
                ) : (
                  <img
                    src="/default-avatar.svg"
                    alt="Photo de profil"
                    className="h-10 w-10 rounded-full object-cover border-2 border-pdc-cyan-300 hover:border-pdc-cyan transition-colors"
                  />
                )}
                <span className="ml-2 text-sm font-medium text-theme-secondary hidden lg:block">
                  {user?.firstName}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Header - Minimal top bar */}
      <header className="md:hidden bg-theme-card shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-4">
          <Link to="/dashboard" className="flex items-center">
            <img 
              src="/logo.svg" 
              alt="Prix du Coeur" 
              className="h-9 w-9 rounded-full"
            />
            <span className="ml-2 text-lg font-semibold text-theme-primary">
              Prix du Coeur
            </span>
          </Link>
        </div>
      </header>

      {/* Mobile Navigation - Bottom bar (like Deezer, Spotify, etc.) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-theme-card border-t border-theme-secondary shadow-lg safe-area-bottom">
        <div className="flex justify-around items-center h-20 px-2">
          {mobileNavigation.map((item) => {
            const active = isActive(item.href);
            const Icon = active ? item.iconActive : item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${
                  active 
                    ? 'text-pdc-cyan' 
                    : 'text-theme-tertiary hover:text-theme-secondary'
                }`}
              >
                <Icon className={`h-7 w-7 ${active ? 'scale-110' : ''} transition-transform`} />
                <span className={`text-[11px] mt-1.5 font-medium ${active ? 'font-semibold' : ''}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
