import React from "react";
import { Link, useLocation } from "react-router-dom";

const Navigation: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string): boolean => {
    if (path === "/" && currentPath === "/") return true;
    if (path !== "/" && currentPath.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="flex space-x-6 mt-2 md:mt-0">
      <Link
        to="/"
        className={`font-medium border-b-2 pb-1 transition-colors ${
          isActive("/")
            ? "text-white border-blue-500"
            : "text-gray-400 hover:text-white border-transparent hover:border-gray-700"
        }`}
      >
        Home
      </Link>
      <Link
        to="/pools"
        className={`font-medium border-b-2 pb-1 transition-colors ${
          isActive("/pools")
            ? "text-white border-blue-500"
            : "text-gray-400 hover:text-white border-transparent hover:border-gray-700"
        }`}
      >
        Pools
      </Link>
      <Link
        to="/lending"
        className={`font-medium border-b-2 pb-1 transition-colors ${
          isActive("/lending")
            ? "text-white border-blue-500"
            : "text-gray-400 hover:text-white border-transparent hover:border-gray-700"
        }`}
      >
        Lending
      </Link>
      <Link
        to="/positions"
        className={`font-medium border-b-2 pb-1 transition-colors ${
          isActive("/positions")
            ? "text-white border-blue-500"
            : "text-gray-400 hover:text-white border-transparent hover:border-gray-700"
        }`}
      >
        My Positions
      </Link>
    </div>
  );
};

export default Navigation;
