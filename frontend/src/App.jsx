import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Layout from "./shared/Layout";
import Attendance from "./components/Attendance";
import Login from "./shared/Login";
import ProtectedRoute from "./service/ProtectedRoute";
import EmployeeList from "./components/EmployeeList";
import Dashboard from "./components/Dashboard";
import BrandManagement from "./components/BrandManagement";
import DailyEntry from "./components/DailyEntry";


import SiteManagement from "./components/SiteManagement";
import SupplierManagement from "./components/SupplierManagement";
import Machine from "./components/Machine";
import CompressorManagement from "./components/CompressorManagement";
import UserManagement from "./components/UserManagement";
import SparesManagement from "./components/SparesManagement";
import DrillingToolsManagement from "./components/DrillingToolsManagement";
import InventoryManagement from "./components/InventoryManagement";
import PurchaseOrderManagement from "./components/PurchaseOrderManagement";

import Reports from "./components/Reports";
import MachineServiceHistory from "./components/MachineServiceHistory";
import CompressorServiceHistory from "./components/CompressorServiceHistory";
import AddressManagement from "./components/AddressManagement";
import ProductionReport from "./components/ProductionReport";
import SiteProductionReport from "./components/SiteProductionReport";
import ProductionDetail from "./components/ProductionDetail";
import EmployeeDetails from "./components/EmployeeDetails";
import ServiceUsageReport from "./components/ServiceUsageReport";
import SparesReport from "./components/SparesReport";
import DailyEntryReport from "./components/DailyEntryReport";
import AttendanceReport from "./components/AttendanceReport";
import DrillingToolsReport from "./components/DrillingToolsReport";

import NotFound from "./components/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes (require JWT) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              {/* Redirect root to daily-entry */}
              <Route index element={<Navigate to="/daily-entry" replace />} />

              {/* Main routes */}
              {/* Main routes */}
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="brand" element={<BrandManagement />} />
              <Route path="daily-entry" element={<DailyEntry />} />


              <Route path="site" element={<SiteManagement />} />
              <Route path="supplier" element={<SupplierManagement />} />
              {/* <Route path="vehicle" element={<Machine />} /> */}
              <Route path="machine" element={<Machine />} />
              <Route path="compressor" element={<CompressorManagement />} />
              <Route path="user-management" element={<UserManagement />} />
              <Route path="address" element={<AddressManagement />} />

              <Route path="spares" element={<SparesManagement />} />
              <Route path="drilling-tools" element={<DrillingToolsManagement />} />
              <Route path="inventory" element={<InventoryManagement />} />
              <Route path="purchase-orders" element={<PurchaseOrderManagement />} />


              {/* Employee sub-routes */}
              <Route path="employee/attendance" element={<Attendance />} />
              <Route path="employee/list" element={<EmployeeList />} />
              <Route path="employee/details/:id" element={<EmployeeDetails />} />

              {/* Reports sub-routes */}
              <Route path="reports" element={<Reports />} />
              <Route path="reports/service-usage" element={<ServiceUsageReport />} />
              <Route path="reports/spares-summary" element={<SparesReport />} />
              <Route path="reports/production" element={<SiteProductionReport />} />
              <Route path="reports/daily" element={<DailyEntryReport />} />
              <Route path="reports/attendance" element={<AttendanceReport />} />
              <Route path="reports/drilling-tools" element={<DrillingToolsReport />} />

              <Route path="reports/machine-service/:machineId" element={<MachineServiceHistory />} />
              <Route path="reports/compressor-service/:compressorId" element={<CompressorServiceHistory />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
