import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  HomeIcon, 
  ArrowUpTrayIcon, 
  ScaleIcon, 
  HeartIcon,
  BanknotesIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Tableau de bord', href: '/dashboard', icon: HomeIcon },
    { name: 'Comptes', href: '/accounts', icon: BanknotesIcon },
    { name: 'Importer CSV', href: '/import', icon: ArrowUpTrayIcon },
    { name: 'Couple', href: '/couple', icon: HeartIcon },
    { name: 'Harmonisation', href: '/harmonization', icon: ScaleIcon },
  ];

  const isActive = (href) => location.pathname === href;

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl sm:text-2xl font-bold text-pink-600">
                💖 <span className="hidden xs:inline">Prix du coeur</span><span className="xs:hidden">PDC</span>
              </h1>
            </div>
            {/* Desktop navigation */}
            <div className="hidden md:ml-6 md:flex md:space-x-4 lg:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    isActive(item.href)
                      ? 'border-pink-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <item.icon className="h-5 w-5 mr-1" />
                  <span className="hidden lg:inline">{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
          
          {/* Desktop user section */}
          <div className="hidden md:flex items-center">
            <span className="text-sm text-gray-700 mr-4 truncate max-w-[150px]">
              {user?.firstName}
            </span>
            <button
              onClick={logout}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-pink-600 hover:bg-pink-700"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span className="hidden lg:inline ml-1">Déconnexion</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`${
                  isActive(item.href)
                    ? 'bg-pink-50 border-pink-500 text-pink-700'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                } flex items-center px-3 py-3 border-l-4 text-base font-medium`}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="flex items-center px-4">
              <div className="flex-1">
                <p className="text-base font-medium text-gray-800">{user?.firstName} {user?.lastName}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
            </div>
            <div className="mt-3 px-2">
              <button
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center px-4 py-3 text-base font-medium text-white bg-pink-600 rounded-md hover:bg-pink-700"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
