import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { MenuOutlined } from "@ant-design/icons";
import { Typography } from "antd";
import vaLogo from "../assets/VA.png";
import lightLogo from "../assets/hi.jpg";
import { getUserRole, getUsername, isTownAdmin } from "../service/auth";
import ServiceAlerts from "../components/ServiceAlerts";
// import { MdDashboard } from "react-icons/md";
import { TbReport } from "react-icons/tb";
import {
  FaUsersCog,
  FaEdit,
  FaMapMarkerAlt,
  FaTruck,
  FaTractor,
  FaWind,
  FaTag,
  FaAddressBook,
  FaCogs,
  FaTools,
  FaWarehouse,
  FaFileInvoiceDollar,
  FaWrench,
  FaUserFriends,
  FaUserClock
} from "react-icons/fa";

const navArray = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: <TbReport />, // Using Report icon for now, or could use another if available
  },
  {
    label: "Daily Entry",
    path: "/daily-entry",
    icon: <FaEdit />,
  },

  {
    label: "Purchase Orders",
    path: "/purchase-orders",
    icon: <FaFileInvoiceDollar />,
  },
  {
    label: "Inventory",
    path: "/inventory",
    icon: <FaWarehouse />,
  },
  {
    label: "Employees",
    icon: <FaUserFriends />,
    children: [
      {
        label: "Attendance",
        path: "/employee/attendance",
        icon: <FaUserClock />,
      },
      {
        label: "Employee List",
        path: "/employee/list",
        icon: <FaUserFriends />,
      },
    ],
  },
  {
    label: "Machines",
    path: "/machine",
    icon: <FaTractor />,
  },
  {
    label: "Compressors",
    path: "/compressor",
    icon: <FaWind />,
  },
  {
    label: "Sites",
    path: "/site",
    icon: <FaMapMarkerAlt />,
  },
  {
    label: "Suppliers",
    path: "/supplier",
    icon: <FaTruck />,
  },

  {
    label: "Spares",
    path: "/spares",
    icon: <FaCogs />,
  },
  {
    label: "Drilling Tools",
    path: "/drilling-tools",
    icon: <FaTools />,
  },
  {
    label: "Brand",
    path: "/brand",
    icon: <FaTag />,
  },
  {
    label: "Address",
    path: "/address",
    icon: <FaAddressBook />,
  },
  {
    label: "Reports",
    path: "/reports",
    icon: <TbReport />,
    children: [
      {
        label: "Drilling Tools Report",
        path: "/reports/drilling-tools",
        icon: <TbReport />
      },
      {
        label: "Spares Usage Report",
        path: "/reports/spares-summary",
        icon: <TbReport />
      },
      {
        label: "Production",
        path: "/reports/production",
        icon: <TbReport />
      },
      {
        label: "Daily Report",
        path: "/reports/daily",
        icon: <TbReport />
      },
      {
        label: "Attendance Report",
        path: "/reports/attendance",
        icon: <TbReport />
      },
      {
        label: "Inventory Report",
        path: "/reports/inventory",
        icon: <TbReport />
      }
    ]
  },
  {
    icon: <FaUsersCog />,
    label: "User Management",
    path: "/user-management",
    adminOnly: true
  },
];

export default function Layout() {
  const [activeMenu, setActiveMenu] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  const handleNavClick = (item) => {
    if (item.children) {
      setActiveMenu(item.label === activeMenu ? null : item.label);
    } else {
      navigate(item.path);
      setActiveMenu(null);
      // setSidebarOpen(false);
    }
  };

  const handleSubNavClick = (path) => {
    navigate(path);
    setActiveMenu(null);
    // setSidebarOpen(false);
  };

  const isActiveRoute = (path) => location.pathname === path;

  const isParentActive = (item) => {
    if (item.children) {
      return item.children.some((child) => location.pathname === child.path);
    }
    return location.pathname === item.path;
  };

  // Filter navigation based on user role
  const filteredNavArray = navArray.filter((item) => {
    // Only xtown-admin should see User Management
    if (item.adminOnly) {
      return isTownAdmin();
    }
    // Everyone else sees all other items as per normal auth
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 ">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center h-16 bg-gradient-to-r from-purple-900 via-purple-800 to-purple-600 shadow-lg">
        <div className="flex items-center pl-6 gap-20">
          <img src={vaLogo} className="h-10 w-auto" />

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
          >
            <MenuOutlined className="text-xl" />
          </button>
        </div>
        {/* <span
        className="dev"
        >Developed by <a href="https://instagram.com/last_autumnleaf/">:)</a> aravindh</span> */}
        <div className="relative pr-6 flex items-center gap-3 text-white/90">
          <ServiceAlerts />
          <span className="hidden sm:inline-block text-sm opacity-90">
            {getUsername() || "User"}
          </span>
          <div
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/30 transition-all duration-200"
            onClick={() => setShowUserDropdown((prev) => !prev)}
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>

          {showUserDropdown && (
            <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl p-2 z-50 min-w-[120px] border">
              <button
                className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
                onClick={logout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)] pt-16">
        {/* Main Sidebar */}
        <aside className={`${sidebarOpen ? 'hidden sm:flex' : 'hidden'} w-64 bg-white shadow-lg border-r border-gray-200 flex-col fixed left-0 top-16 bottom-0 z-40 transition-all duration-300`}>
          <div className="p-4 flex-1 overflow-y-auto sidebar-scroll">

            <div className="flex flex-col space-y-1">
              {filteredNavArray.map((item) => (

                <button
                  key={item.label}
                  className={`
                    w-full text-left px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-between
                    ${isParentActive(item) || activeMenu === item.label
                      ? "bg-purple-50 text-purple-700 border-l-4 border-purple-600"
                      : "text-gray-700 hover:bg-gray-50 hover:text-purple-600"
                    }
                  `}
                  onClick={() => handleNavClick(item)}
                >
                  <span className="flex items-center gap-3">
                    {item.icon && <span className="text-lg">{item.icon}</span>}
                    <span>{item.label}</span>
                  </span>

                  {item.children
                    && (
                      <svg
                        className={`w-4 h-4 transition-transform ${activeMenu === item.label ? "rotate-90" : ""
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar Bottom - Light Logo - Fixed */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex justify-center">
              <img src={lightLogo} className="h-8 w-auto opacity-60" alt="Light Logo" />
            </div>
          </div>
        </aside>

        {/* Sub Sidebar */}
        {activeMenu && sidebarOpen && (
          <aside className="hidden sm:block w-56 bg-gray-50 border-r border-gray-200 fixed left-64 top-16 bottom-0 z-30 transition-all duration-300">
            <div className="p-4 h-full overflow-y-auto sidebar-scroll">
              <div className="mb-4">
                <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
                  {activeMenu}
                </h3>
              </div>

              <div className="flex flex-col space-y-1">
                {filteredNavArray
                  .find((x) => x.label === activeMenu)
                  ?.children?.map((sub) => (
                    <div >

                      <button
                        key={sub.label}
                        className={`
                        w-full flex gap-2 items-center text-left px-4 py-2.5 rounded-lg text-sm transition-all duration-200
                        ${isActiveRoute(sub.path)
                            ? "bg-purple-100 text-purple-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100 hover:text-purple-600"
                          }
                      `}
                        onClick={() => handleSubNavClick(sub.path)}
                      >
                        {sub.icon}
                        {sub.label}
                      </button>
                    </div>

                  ))}
              </div>
            </div>
          </aside>
        )}

        {/* Main content area */}
        <main className={`flex-1 bg-gray-50 flex flex-col ${sidebarOpen ? (activeMenu ? 'sm:ml-56' : 'sm:ml-64') : 'sm:ml-0'} pb-16 main-content-scroll transition-all duration-300`}>
          <div className="p-6 flex-1">
            <Outlet />
          </div>


        </main>
      </div>
    </div>
  );
}