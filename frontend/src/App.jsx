// App.jsx
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
import ItemManagement from "./components/ItemManagement";
import StockReport from "./components/StockReport";
import PurchaseOrderComplete from "./components/PurchaseOrderComplete";
import SiteManagement from "./components/SiteManagement";
import SupplierManagement from "./components/SupplierManagement";
import Machine from "./components/Machine";
import CompressorManagement from "./components/CompressorManagement";
import UserManagement from "./components/UserManagement";
import Reports from "./components/Reports";
// import ItemStockReport from "./components/ItemStockReport"; // Commented out - page hidden
import MachineServiceHistory from "./components/MachineServiceHistory";
import CompressorServiceHistory from "./components/CompressorServiceHistory";
import AddressManagement from "./components/AddressManagement";
// import InventoryManagement from "./components/InventoryManagement"; // Commented out - page hidden
import ProductionReport from "./components/ProductionReport";
import SiteProductionReport from "./components/SiteProductionReport";
import ProductionDetail from "./components/ProductionDetail";
import EmployeeDetails from "./components/EmployeeDetails";
import InventoryReport from "./components/InventoryReport";
import ServiceUsageReport from "./components/ServiceUsageReport";
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
            {/* Redirect root to dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Main routes */}
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="brand" element={<BrandManagement />} />
            <Route path="daily-entry" element={<DailyEntry />} />
            <Route path="item-management" element={<ItemManagement />} />
            <Route path="items" element={<ItemManagement />} />
            <Route path="stock-report" element={<StockReport />} />
            {/* <Route path="inventory-management" element={<InventoryManagement />} /> */} {/* Commented out - page hidden */}
            <Route path="site" element={<SiteManagement />} />
            <Route path="supplier" element={<SupplierManagement />} />
            <Route path="vehicle" element={<Machine />} /> {/* Route path kept for compatibility */}
            <Route path="compressor" element={<CompressorManagement />} />
            <Route path="user-management" element={<UserManagement />} />
            <Route path="address" element={<AddressManagement />} />

            {/* Employee sub-routes */}
            <Route path="employee/attendance" element={<Attendance />} />
            <Route path="employee/list" element={<EmployeeList />} />
            <Route path="employee/details/:id" element={<EmployeeDetails />} />

            {/* Purchase Order */}
            <Route path="purchase-order" element={<PurchaseOrderComplete />} />

            {/* Reports sub-routes */}
            <Route path="reports" element={<Reports />} />
            {/* <Route path="reports/item-stock" element={<ItemStockReport />} /> */} {/* Commented out - page hidden */}
            <Route path="reports/production" element={<SiteProductionReport />} />
            <Route path="reports/production-detailed" element={<ProductionReport />} />
            <Route path="reports/production/detail" element={<ProductionDetail />} />
            <Route path="reports/inventory" element={<InventoryReport />} />
            <Route path="reports/service-usage" element={<ServiceUsageReport />} />
            <Route path="reports/vehicle-service/:vehicleId" element={<MachineServiceHistory />} /> {/* Route path kept for compatibility */}
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
