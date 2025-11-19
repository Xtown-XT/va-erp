// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  DatePicker,
  Button,
  Select,
  Typography,
  Space,
  Divider,
  message,
  Modal,
  Tag,
} from "antd";
import {
  FilePdfOutlined,
  ReloadOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import api from "../service/api";
import { truncateToFixed } from "../utils/textUtils";
import dayjs from "dayjs";

const { Title, Text } = Typography;

const ProductionReport = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'days'), dayjs()]);
  const [productionData, setProductionData] = useState([]);
  const [totals, setTotals] = useState({});
  const [sites, setSites] = useState([]);
  const [machines, setMachines] = useState([]);
  const [compressors, setCompressors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedSite, setSelectedSite] = useState(undefined);
  const [selectedSiteName, setSelectedSiteName] = useState('');
  const [selectedMachine, setSelectedMachine] = useState(undefined);
  const [selectedMachineName, setSelectedMachineName] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(undefined);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const navigate = useNavigate();
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Fetch production data
  const fetchProductionData = async () => {
    setLoading(true);
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      let url = `/api/dailyEntries?startDate=${startDate}&endDate=${endDate}&limit=10000`;
      if (selectedSite) {
        url += `&siteId=${selectedSite}`;
      }
      if (selectedMachine) {
        url += `&vehicleId=${selectedMachine}`;
      }
      if (selectedEmployee) {
        url += `&employeeId=${selectedEmployee}`;
      }

      const res = await api.get(url);
      let entries = res.data.data || [];

      // Fetch services for the date range to match with entries
      
      // Collect unique vehicle and compressor IDs from entries
      const vehicleIds = [...new Set(entries.map(e => e.vehicleId).filter(Boolean))];
      const compressorIds = [...new Set(entries.map(e => e.compressorId).filter(Boolean))];
      
      // Fetch services - need to fetch by vehicleId and compressorId separately
      // or fetch all and filter client-side
      let allServices = [];
      
      try {
        // Fetch services for vehicles
        for (const vehicleId of vehicleIds) {
          try {
            const vehicleServicesRes = await api.get(`/api/services?vehicleId=${vehicleId}&limit=1000`);
            const vehicleServices = vehicleServicesRes.data.data || [];
            allServices = [...allServices, ...vehicleServices];
          } catch (err) {
            console.warn(`Could not fetch services for vehicle ${vehicleId}:`, err);
          }
        }
        
        // Fetch services for compressors
        for (const compressorId of compressorIds) {
          try {
            const compressorServicesRes = await api.get(`/api/services?compressorId=${compressorId}&limit=1000`);
            const compressorServices = compressorServicesRes.data.data || [];
            allServices = [...allServices, ...compressorServices];
          } catch (err) {
            console.warn(`Could not fetch services for compressor ${compressorId}:`, err);
          }
        }
        
        // Filter services by date range
        allServices = allServices.filter(service => {
          if (!service.serviceDate) return false;
          const serviceDate = dayjs(service.serviceDate).format('YYYY-MM-DD');
          return serviceDate >= startDate && serviceDate <= endDate;
        });
        
        // Match services to entries by date, vehicleId, and compressorId
        entries = entries.map(entry => {
          const entryDate = entry.date;
          const matchedServices = allServices.filter(service => {
            const serviceDate = service.serviceDate ? dayjs(service.serviceDate).format('YYYY-MM-DD') : null;
            
            // Match if service date matches entry date AND
            // (vehicleId matches OR compressorId matches)
            if (serviceDate === entryDate) {
              const vehicleMatch = service.vehicleId && entry.vehicleId && service.vehicleId === entry.vehicleId;
              const compressorMatch = service.compressorId && entry.compressorId && service.compressorId === entry.compressorId;
              return vehicleMatch || compressorMatch;
            }
            return false;
          });
          
          return {
            ...entry,
            services: matchedServices // Add services array to each entry
          };
        });
      } catch (servicesErr) {
        console.warn("Could not fetch services:", servicesErr);
        // Continue without services if API call fails
        entries = entries.map(entry => ({ ...entry, services: [] }));
      }


      // Calculate production metrics
      const calculations = calculateProductionMetrics(entries);
      setProductionData(calculations.dailyData);
      setTotals(calculations.totals);
    } catch (err) {
      console.error("Error fetching production data", err);
      message.error("Error fetching production data");
    } finally {
      setLoading(false);
    }
  };

  // Calculate production metrics
  const calculateProductionMetrics = (entries) => {
    let totalCrawlerHSD = 0;
    let totalCamperHSD = 0;
    let totalCompressorHSD = 0;
    let totalTotalHSD = 0;
    let totalMeter = 0;
    let totalCrawlerRPM = 0;
    let totalCompressorRPM = 0;
    let totalHoles = 0;

    // const dailyData = entries.map(entry => {
    //   // Vehicle HSD should come from vehicleHSD, not dieselUsed (which is overall)
    //   const vehicleHSD = entry.vehicleHSD || 0;
    //   const meter = entry.meter || 0;
    //   const vehicleRPM = (entry.vehicleClosingRPM || 0) - (entry.vehicleOpeningRPM || 0);
    //   const compressorRPM = (entry.compressorClosingRPM || 0) - (entry.compressorOpeningRPM || 0);
    //   const holes = entry.noOfHoles || 0;
    //   const compressorHSD = entry.compressorHSD || 0;

    //   // Find machine type
    //   // Prefer server-provided vehicle info; fallback to machines cache
    //   const machineTypeSrc = (entry.vehicle?.vehicleType) || (machines.find(m => m.id === entry.vehicleId)?.vehicleType) || '';
    //   const machineType = machineTypeSrc.toString().trim().toLowerCase();
    //   const isCrawler = machineType === 'crawler' || machineType.includes('crawler');
    //   const isCamper = machineType === 'camper' || machineType.includes('camper') || machineType.includes('truck');

    //   // Calculate HSD breakdown
    //   let crawlerHSD = 0;
    //   let camperHSD = 0;
    //   let crawlerRPM = 0;

    //   if (isCrawler) {
    //     crawlerHSD = vehicleHSD;
    //     crawlerRPM = vehicleRPM;
    //   } else if (isCamper) {
    //     camperHSD = vehicleHSD;
    //   }

    //   const totalHSD = crawlerHSD + camperHSD + compressorHSD;

    //   // Calculate ratios
    //   const hsdMtr = meter > 0 ? ((totalHSD) / meter).toFixed(2) : 0;
    //   const mtrRPM = compressorRPM > 0 ? (meter / compressorRPM).toFixed(2) : 0;
    //   const crawlerHsdPerRpm = crawlerRPM > 0 ? (crawlerHSD / crawlerRPM).toFixed(2) : 0;
    //   const compHsdPerRpm = compressorRPM > 0 ? (compressorHSD / compressorRPM).toFixed(2) : 0;
    //   const depthAvg = holes > 0 ? (meter / holes).toFixed(2) : 0;

    //   // Add to totals
    //   totalCrawlerHSD += crawlerHSD;
    //   totalCamperHSD += camperHSD;
    //   totalCompressorHSD += compressorHSD;
    //   totalTotalHSD += totalHSD;
    //   totalMeter += meter;
    //   totalCrawlerRPM += crawlerRPM;
    //   totalCompressorRPM += compressorRPM;
    //   totalHoles += holes;

    //   return {
    //     ...entry,
    //     isCrawler,
    //     isCamper,
    //     crawlerHSD,
    //     camperHSD,
    //     compressorHSD,
    //     totalHSD,
    //     crawlerRPM,
    //     compressorRPM,
    //     hsdMtr,
    //     mtrRPM,
    //     crawlerHsdPerRpm,
    //     compHsdPerRpm,
    //     depthAvg,
    //     // Display-only values: blank when not applicable
    //     crawlerHSDDisplay: isCrawler ? (crawlerHSD || 0) : '',
    //     camperHSDDisplay: isCamper ? (camperHSD || 0) : '',
    //     crawlerRPMDisplay: isCrawler ? (crawlerRPM || 0) : '',
    //   };
    // });

    // Calculate totals for summary


    // const totals = {
    //   totalCrawlerHSD,
    //   totalCamperHSD,
    //   totalCompressorHSD,
    //   totalTotalHSD,
    //   totalMeter,
    //   totalCrawlerRPM,
    //   totalCompressorRPM,
    //   totalHoles,
    //   totalHsdMtr: totalMeter > 0 ? (totalTotalHSD / totalMeter).toFixed(2) : 0,
    //   totalMtrRPM: totalCompressorRPM > 0 ? (totalMeter / totalCompressorRPM).toFixed(2) : 0,
    //   totalCrawlerHsdPerRpm: totalCrawlerRPM > 0 ? (totalCrawlerHSD / totalCrawlerRPM).toFixed(2) : 0,
    //   totalCompHsdPerRpm: totalCompressorRPM > 0 ? (totalCompressorHSD / totalCompressorRPM).toFixed(2) : 0,
    //   totalDepthAvg: totalHoles > 0 ? (totalMeter / totalHoles).toFixed(2) : 0,
    // };



    const dailyData = entries.map(entry => {

      const vehicleHSD = parseFloat(entry.vehicleHSD) || 0;
      const meter = parseFloat(entry.meter) || 0;
      const vehicleRPM = (parseFloat(entry.vehicleClosingRPM) || 0) - (parseFloat(entry.vehicleOpeningRPM) || 0);
      const compressorRPM = (parseFloat(entry.compressorClosingRPM) || 0) - (parseFloat(entry.compressorOpeningRPM) || 0);
      const holes = parseFloat(entry.noOfHoles) || 0;
      const compressorHSD = parseFloat(entry.compressorHSD) || 0;


      const machineTypeSrc = (entry.vehicle?.vehicleType) || (machines.find(m => m.id === entry.vehicleId)?.vehicleType) || '';
      const machineType = machineTypeSrc.toString().trim().toLowerCase();
      const isCrawler = machineType === 'crawler' || machineType.includes('crawler');
      const isCamper = machineType === 'camper' || machineType.includes('camper') || machineType.includes('truck');


      let crawlerHSD = 0;
      let camperHSD = 0;
      let crawlerRPM = 0;

      if (isCrawler) {
        crawlerHSD = vehicleHSD;
        crawlerRPM = vehicleRPM;
      } else if (isCamper) {
        camperHSD = vehicleHSD;
      }


      const totalHSD = parseFloat((crawlerHSD + camperHSD + compressorHSD).toFixed(2));


      const hsdMtr = meter > 0 ? parseFloat((totalHSD / meter).toFixed(2)) : 0;
      const mtrRPM = compressorRPM > 0 ? parseFloat((meter / compressorRPM).toFixed(2)) : 0;
      const crawlerHsdPerRpm = crawlerRPM > 0 ? parseFloat((crawlerHSD / crawlerRPM).toFixed(2)) : 0;
      const compHsdPerRpm = compressorRPM > 0 ? parseFloat((compressorHSD / compressorRPM).toFixed(2)) : 0;
      const depthAvg = holes > 0 ? parseFloat((meter / holes).toFixed(2)) : 0;


      totalCrawlerHSD += crawlerHSD;
      totalCamperHSD += camperHSD;
      totalCompressorHSD += compressorHSD;
      totalTotalHSD += totalHSD;
      totalMeter += meter;
      totalCrawlerRPM += crawlerRPM;
      totalCompressorRPM += compressorRPM;
      totalHoles += holes;

      return {
        ...entry,
        site: entry.site, // Explicitly preserve site object
        isCrawler,
        isCamper,
        crawlerHSD: parseFloat(crawlerHSD.toFixed(2)),
        camperHSD: parseFloat(camperHSD.toFixed(2)),
        compressorHSD: parseFloat(compressorHSD.toFixed(2)),
        totalHSD,
        meter,
        crawlerRPM,
        compressorRPM,
        hsdMtr,
        mtrRPM,
        crawlerHsdPerRpm,
        compHsdPerRpm,
        holes,
        depthAvg,
        // Display-only values
        crawlerHSDDisplay: isCrawler ? crawlerHSD : '',
        camperHSDDisplay: isCamper ? camperHSD : '',
        crawlerRPMDisplay: isCrawler ? crawlerRPM : '',
        // Preserve services array if it exists
        services: entry.services || [],
      };
    });

    const totals = {
      totalCrawlerHSD: parseFloat(totalCrawlerHSD.toFixed(2)),
      totalCamperHSD: parseFloat(totalCamperHSD.toFixed(2)),
      totalCompressorHSD: parseFloat(totalCompressorHSD.toFixed(2)),
      totalTotalHSD: parseFloat(totalTotalHSD.toFixed(2)),
      totalMeter: parseFloat(totalMeter.toFixed(2)),
      totalCrawlerRPM: parseFloat(totalCrawlerRPM.toFixed(2)),
      totalCompressorRPM: parseFloat(totalCompressorRPM.toFixed(2)),
      totalHoles: parseFloat(totalHoles.toFixed(2)),

      // FIXED: Proper ratio calculations
      totalHsdMtr: totalMeter > 0 ? parseFloat((totalTotalHSD / totalMeter).toFixed(2)) : 0,
      totalMtrRPM: totalCompressorRPM > 0 ? parseFloat((totalMeter / totalCompressorRPM).toFixed(2)) : 0,
      totalCrawlerHsdPerRpm: totalCrawlerRPM > 0 ? parseFloat((totalCrawlerHSD / totalCrawlerRPM).toFixed(2)) : 0,
      totalCompHsdPerRpm: totalCompressorRPM > 0 ? parseFloat((totalCompressorHSD / totalCompressorRPM).toFixed(2)) : 0,
      totalDepthAvg: totalHoles > 0 ? parseFloat((totalMeter / totalHoles).toFixed(2)) : 0,
    };

    return { dailyData, totals };
  };

  // (removed duplicate fetchVehicles and invalid selectedVehicle dependency)

  // Table columns
  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (date) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Shift",
      dataIndex: "shift",
      key: "shift",
      width: 80,
      render: (shift) => shift || 1,
    },
    {
      title: "Site",
      dataIndex: ["site", "siteName"],
      key: "site",
      width: 150,
      render: (value, record) => {
        // Try site object first, then fallback to sites array lookup
        if (record.site?.siteName) {
          return record.site.siteName;
        }
        if (record.siteId) {
          const site = sites.find(s => s.id === record.siteId);
          return site?.siteName || '-';
        }
        return '-';
      },
    },
    {
      title: "Meter",
      dataIndex: "meter",
      key: "meter",
      width: 120,
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "Crawler HSD",
      dataIndex: "crawlerHSDDisplay",
      key: "crawlerHSD",
      render: (value, record) => record.isCrawler ? Math.round(value || 0) : '',
    },
    {
      title: "Comp HSD",
      dataIndex: "compressorHSD",
      key: "compressorHSD",
      render: (value) => Math.round(value || 0),
    },
    {
      title: "Camper HSD",
      dataIndex: "camperHSDDisplay",
      key: "camperHSD",
      render: (value, record) => record.isCamper ? Math.round(value || 0) : '',
    },
    {
      title: "Total HSD",
      dataIndex: "totalHSD",
      key: "totalHSD",
      render: (value) => Math.round(value || 0),
    },
    {
      title: "Crawler RPM",
      dataIndex: "crawlerRPMDisplay",
      key: "crawlerRPM",
      render: (value, record) => record.isCrawler ? Number(value || 0).toFixed(2) : '',
    },
    {
      title: "Comp RPM",
      dataIndex: "compressorRPM",
      key: "compressorRPM",
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "HSD/MTR",
      dataIndex: "hsdMtr",
      key: "hsdMtr",
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "MTR/RPM",
      dataIndex: "mtrRPM",
      key: "mtrRPM",
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "Crawler HSD/Crawler RPM",
      dataIndex: "crawlerHsdPerRpm",
      key: "crawlerHsdPerRpm",
      render: (value) => value > 0 ? truncateToFixed(value, 2) : '-',
    },
    {
      title: "Comp HSD/Comp RPM",
      dataIndex: "compHsdPerRpm",
      key: "compHsdPerRpm",
      render: (value) => value > 0 ? truncateToFixed(value, 2) : '-',
    },
    {
      title: "Number of Holes",
      dataIndex: "noOfHoles",
      key: "noOfHoles",
      render: (value) => value || 0,
    },
    {
      title: "Depth Avg",
      dataIndex: "depthAvg",
      key: "depthAvg",
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, record) => (
        <Button
          icon={<EyeOutlined />}
          size="small"
          onClick={() => {
            setSelectedEntry(record);
            setShowDetailModal(true);
          }}
        >
          Detail
        </Button>
      ),
    },
  ];

  // Export to PDF
  const exportToPDF = async () => {
    setLoading(true);
    
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      let url = `/api/dailyEntries?startDate=${startDate}&endDate=${endDate}&limit=10000`;
      if (selectedSite) url += `&siteId=${selectedSite}`;
      if (selectedMachine) url += `&vehicleId=${selectedMachine}`;
      if (selectedEmployee) url += `&employeeId=${selectedEmployee}`;

      const res = await api.get(url);
      let entries = res.data.data || [];
      
      // Fetch machines, compressors, and sites for PDF (if not already available)
      let pdfMachines = machines;
      let pdfCompressors = compressors;
      let pdfSites = sites;
      
      if (machines.length === 0) {
        try {
          const machinesRes = await api.get('/api/vehicles?limit=1000');
          pdfMachines = machinesRes.data.data || [];
        } catch (err) {
          console.warn('Could not fetch machines for PDF:', err);
        }
      }
      
      if (compressors.length === 0) {
        try {
          const compressorsRes = await api.get('/api/compressors?limit=1000');
          pdfCompressors = compressorsRes.data.data || [];
        } catch (err) {
          console.warn('Could not fetch compressors for PDF:', err);
        }
      }
      
      if (sites.length === 0) {
        try {
          const sitesRes = await api.get('/api/sites?limit=1000');
          pdfSites = sitesRes.data.data || [];
        } catch (err) {
          console.warn('Could not fetch sites for PDF:', err);
        }
      }

      // Fetch services for PDF export
      const pdfVehicleIds = [...new Set(entries.map(e => e.vehicleId).filter(Boolean))];
      const pdfCompressorIds = [...new Set(entries.map(e => e.compressorId).filter(Boolean))];
      
      let pdfAllServices = [];
      
      try {
        // Fetch services for vehicles
        for (const vehicleId of pdfVehicleIds) {
          try {
            const vehicleServicesRes = await api.get(`/api/services?vehicleId=${vehicleId}&limit=1000`);
            const vehicleServices = vehicleServicesRes.data.data || [];
            pdfAllServices = [...pdfAllServices, ...vehicleServices];
          } catch (err) {
            console.warn(`Could not fetch services for vehicle ${vehicleId}:`, err);
          }
        }
        
        // Fetch services for compressors
        for (const compressorId of pdfCompressorIds) {
          try {
            const compressorServicesRes = await api.get(`/api/services?compressorId=${compressorId}&limit=1000`);
            const compressorServices = compressorServicesRes.data.data || [];
            pdfAllServices = [...pdfAllServices, ...compressorServices];
          } catch (err) {
            console.warn(`Could not fetch services for compressor ${compressorId}:`, err);
          }
        }
        
        // Filter services by date range
        pdfAllServices = pdfAllServices.filter(service => {
          if (!service.serviceDate) return false;
          const serviceDate = dayjs(service.serviceDate).format('YYYY-MM-DD');
          return serviceDate >= startDate && serviceDate <= endDate;
        });
        
        // Match services to entries
        entries = entries.map(entry => {
          const entryDate = entry.date ? dayjs(entry.date).format('YYYY-MM-DD') : null;
          const matchedServices = pdfAllServices.filter(service => {
            const serviceDate = service.serviceDate ? dayjs(service.serviceDate).format('YYYY-MM-DD') : null;
            
            if (serviceDate === entryDate) {
              const vehicleMatch = service.vehicleId && entry.vehicleId && service.vehicleId === entry.vehicleId;
              const compressorMatch = service.compressorId && entry.compressorId && service.compressorId === entry.compressorId;
              return vehicleMatch || compressorMatch;
            }
            return false;
          });
          
          return {
            ...entry,
            site: entry.site, // Preserve site object
            services: matchedServices
          };
        });
      } catch (servicesErr) {
        console.warn("Could not fetch services for PDF:", servicesErr);
        entries = entries.map(entry => ({ ...entry, site: entry.site, services: [] }));
      }

    const { dailyData, totals } = calculateProductionMetrics(entries);

    const printWindow = window.open("", "_blank");
    const reportTitle = selectedSiteName ? 'Daily Production Report - ' + selectedSiteName : 'Daily Production Report';
    
    // Build HTML string to avoid TypeScript template literal parsing issues
    const periodStart = dateRange[0].format("DD/MM/YYYY");
    const periodEnd = dateRange[1].format("DD/MM/YYYY");
    const siteName = selectedSiteName || 'All Sites';
    const generatedDate = new Date().toLocaleDateString();
    
    let htmlContent = '<html><head><title>' + reportTitle + '</title>' +
      '<style>' +
      'body { font-family: Arial, sans-serif; margin: 20px; }' +
      '.header { text-align: center; margin-bottom: 20px; position: relative; }' +
      '.header h1 { margin: 0; font-size: 24px; }' +
      '.header p { margin: 5px 0; }' +
      '.generated-on { position: absolute; top: 0; right: 0; font-size: 12px; }' +
      'table { width: 100%; border-collapse: collapse; margin-top: 20px; }' +
      'th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }' +
      'th { background-color: #f2f2f2; }' +
      '.total-row { background-color: #f9f9f9; font-weight: bold; }' +
      '</style></head><body>' +
      '<div class="header">' +
      '<h1>Daily Production Report</h1>' +
      '<p>Period: ' + periodStart + ' to ' + periodEnd + '</p>' +
      '<p>Site: ' + siteName + '</p>' +
      '<p class="generated-on">Generated on: ' + generatedDate + '</p>' +
      '</div>' +
      '<table><thead><tr>' +
      '<th>Date</th><th>Shift</th><th>Site</th><th>Meter</th>' +
      '<th>Crawler HSD</th><th>Comp HSD</th><th>Camper HSD</th><th>Total HSD</th>' +
      '<th>Crawler RPM</th><th>Comp RPM</th><th>HSD/MTR</th><th>MTR/RPM</th>' +
      '<th>Crawler HSD/Crawler RPM</th><th>Comp HSD/Comp RPM</th>' +
      '<th>Number of Holes</th><th>Depth Avg</th>' +
      '</tr></thead><tbody>';
    
    // Build table rows
    dailyData.forEach((entry) => {
      const services = entry.services || [];
      const servicesText = services.length > 0 
        ? services.map((service) => {
            const serviceTypeLabel = service.serviceType === 'vehicle' ? 'Vehicle' : 
                                   service.serviceType === 'compressor' ? 'Compressor' : 'Item';
            const serviceName = service.serviceName || 'Unnamed Service';
            return serviceTypeLabel + ': ' + serviceName;
          }).join(', ')
        : 'None';
      // Get site name - try site object first, then fallback to sites array lookup
      let siteName = entry.site?.siteName;
      if (!siteName && entry.siteId) {
        const site = pdfSites.find(s => s.id === entry.siteId);
        siteName = site?.siteName;
      }
      siteName = siteName || '-';
      const shiftText = String(entry.shift || 1);
      const dateStr = dayjs(entry.date).format("DD/MM/YYYY");
      const meter = truncateToFixed(entry.meter || 0, 2);
      const crawlerHSD = Math.round(entry.crawlerHSD || 0);
      const compressorHSD = Math.round(entry.compressorHSD || 0);
      const camperHSD = Math.round(entry.camperHSD || 0);
      const totalHSD = Math.round(entry.totalHSD || 0);
      const crawlerRPM = truncateToFixed(entry.crawlerRPM || 0, 2);
      const compressorRPM = truncateToFixed(entry.compressorRPM || 0, 2);
      const hsdMtr = truncateToFixed(entry.hsdMtr || 0, 2);
      const mtrRPM = truncateToFixed(entry.mtrRPM || 0, 2);
      const crawlerHsdPerRpm = entry.crawlerHsdPerRpm > 0 ? truncateToFixed(entry.crawlerHsdPerRpm, 2) : '-';
      const compHsdPerRpm = entry.compHsdPerRpm > 0 ? truncateToFixed(entry.compHsdPerRpm, 2) : '-';
      const noOfHoles = entry.noOfHoles || 0;
      const depthAvg = truncateToFixed(entry.depthAvg || 0, 2);
      
      htmlContent += '<tr>' +
        '<td>' + dateStr + '</td>' +
        '<td>' + shiftText + '</td>' +
        '<td>' + siteName + '</td>' +
        '<td>' + meter + '</td>' +
        '<td>' + crawlerHSD + '</td>' +
        '<td>' + compressorHSD + '</td>' +
        '<td>' + camperHSD + '</td>' +
        '<td>' + totalHSD + '</td>' +
        '<td>' + crawlerRPM + '</td>' +
        '<td>' + compressorRPM + '</td>' +
        '<td>' + hsdMtr + '</td>' +
        '<td>' + mtrRPM + '</td>' +
        '<td>' + crawlerHsdPerRpm + '</td>' +
        '<td>' + compHsdPerRpm + '</td>' +
        '<td>' + noOfHoles + '</td>' +
        '<td>' + depthAvg + '</td>' +
        '</tr>';
    });
    
    // Build totals row
    htmlContent += '</tbody><tfoot><tr class="total-row">' +
      '<td>Total</td><td></td><td></td>' +
      '<td>' + truncateToFixed(totals.totalMeter || 0, 2) + '</td>' +
      '<td>' + Math.round(totals.totalCrawlerHSD || 0) + '</td>' +
      '<td>' + Math.round(totals.totalCompressorHSD || 0) + '</td>' +
      '<td>' + Math.round(totals.totalCamperHSD || 0) + '</td>' +
      '<td>' + Math.round(totals.totalTotalHSD || 0) + '</td>' +
      '<td>' + truncateToFixed(totals.totalCrawlerRPM || 0, 2) + '</td>' +
      '<td>' + truncateToFixed(totals.totalCompressorRPM || 0, 2) + '</td>' +
      '<td>' + truncateToFixed(totals.totalHsdMtr || 0, 2) + '</td>' +
      '<td>' + truncateToFixed(totals.totalMtrRPM || 0, 2) + '</td>' +
      '<td>' + (totals.totalCrawlerHsdPerRpm > 0 ? truncateToFixed(totals.totalCrawlerHsdPerRpm, 2) : '-') + '</td>' +
      '<td>' + (totals.totalCompHsdPerRpm > 0 ? truncateToFixed(totals.totalCompHsdPerRpm, 2) : '-') + '</td>' +
      '<td>' + (totals.totalHoles || 0) + '</td>' +
      '<td>' + truncateToFixed(totals.totalDepthAvg || 0, 2) + '</td>' +
      '</tr></tfoot></table>';
    
    // Maintenance section removed as per user request
    
    htmlContent += '</body></html>';
    
    printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    } catch (err) {
      console.error("Error exporting to PDF", err);
      message.error("Error exporting to PDF");
    } finally {
      setLoading(false);
    }
  };

  // Fetch sites and vehicles
  const fetchSites = async () => {
    try {
      const res = await api.get('/api/sites?limit=1000');
      setSites(res.data.data || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };
  const fetchMachines = async () => {
    try {
      const res = await api.get('/api/vehicles?limit=1000');
      setMachines(res.data.data || []);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  const fetchCompressors = async () => {
    try {
      const res = await api.get('/api/compressors?limit=1000');
      setCompressors(res.data.data || []);
    } catch (error) {
      console.error('Error fetching compressors:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/api/employeeLists?limit=1000');
      setEmployees(res.data.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Fetch refs on component mount
  useEffect(() => {
    fetchSites();
    fetchMachines();
    fetchCompressors();
    fetchEmployees();
  }, []);

  // Fetch production data when filters change
  useEffect(() => {
    fetchProductionData();
  }, [dateRange, selectedSite, selectedMachine, selectedEmployee]);

  return (
    <div className="space-y-2">
      {/* Filters */}
      <Card className="mb-2" bodyStyle={{ padding: '8px' }}>
        <Row gutter={8} align="middle">
          <Col xs={24} sm={6} md={4}>
            <DatePicker.RangePicker
              className="w-full"
              value={dateRange}
              onChange={setDateRange}
              format="DD/MM/YYYY"
              size="small"
            />
          </Col>
          <Col xs={24} sm={6} md={3}>
            <Select
              className="w-full"
              placeholder="Filter by Site"
              value={selectedSite || undefined}
              onChange={(value) => {
                setSelectedSite(value || undefined);
                const site = sites.find(s => s.id === value);
                setSelectedSiteName(site ? site.siteName : '');
              }}
              allowClear
              showSearch
              optionFilterProp="children"
              size="small"
            >
              {sites.map(site => (
                <Select.Option key={site.id} value={site.id}>
                  {site.siteName}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6} md={3}>
            <Select
              className="w-full"
              placeholder="Filter by Machine"
              value={selectedMachine || undefined}
              onChange={(value) => {
                setSelectedMachine(value || undefined);
                const machine = machines.find(m => m.id === value);
                setSelectedMachineName(machine ? `${machine.vehicleNumber} (${machine.vehicleType})` : '');
              }}
              allowClear
              showSearch
              optionFilterProp="children"
              size="small"
            >
              {machines.map(machine => (
                <Select.Option key={machine.id} value={machine.id}>
                  {machine.vehicleNumber} ({machine.vehicleType})
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6} md={3}>
            <Select
              className="w-full"
              placeholder="Filter by Employee"
              value={selectedEmployee || undefined}
              onChange={(value) => {
                setSelectedEmployee(value || undefined);
                const employee = employees.find(e => e.id === value);
                setSelectedEmployeeName(employee ? employee.name : '');
              }}
              allowClear
              showSearch
              optionFilterProp="children"
              size="small"
            >
              {employees.map(employee => (
                <Select.Option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.empId})
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6} md={2}>
            <Button
              icon={<EyeOutlined />}
              onClick={() => navigate('/reports/production/detail')}
              type="default"
              size="small"
              className="w-full"
            >
              Show Detail
            </Button>
          </Col>
          <Col xs={24} sm={6} md={2}>
            <Button
              icon={<FilePdfOutlined />}
              onClick={exportToPDF}
              type="primary"
              danger
              size="small"
              className="w-full"
            >
              PDF
            </Button>
          </Col>
          <Col xs={24} sm={6} md={2}>
            <Button
              onClick={() => {
                setSelectedSite(undefined);
                setSelectedSiteName('');
                setSelectedMachine(undefined);
                setSelectedMachineName('');
                setSelectedEmployee(undefined);
                setSelectedEmployeeName('');
              }}
              disabled={!selectedSite && !selectedMachine && !selectedEmployee}
              size="small"
              className="w-full"
            >
              Clear Filters
            </Button>
          </Col>
        </Row>
      </Card>



      {/* Production Data Table */}
      <Card>
        <Title level={4}>Daily Production Data</Title>
        <Table
          columns={columns}
          dataSource={productionData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => range[0] + '-' + range[1] + ' of ' + total + ' entries',
          }}
          scroll={{ x: 1200 }}
          size="small"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Text strong>Total</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={1}></Table.Summary.Cell>

                <Table.Summary.Cell index={2}></Table.Summary.Cell>

                <Table.Summary.Cell index={3}>
                  <Text strong>{truncateToFixed(totals.totalMeter || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={4}>
                  <Text strong>{Math.round(totals.totalCrawlerHSD || 0)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={5}>
                  <Text strong>{Math.round(totals.totalCompressorHSD || 0)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={6}>
                  <Text strong>{Math.round(totals.totalCamperHSD || 0)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={7}>
                  <Text strong>{Math.round(totals.totalTotalHSD || 0)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={8}>
                  <Text strong>{truncateToFixed(totals.totalCrawlerRPM || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={9}>
                  <Text strong>{truncateToFixed(totals.totalCompressorRPM || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={10}>
                  <Text strong>{truncateToFixed(totals.totalHsdMtr || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={11}>
                  <Text strong>{truncateToFixed(totals.totalMtrRPM || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={12}>
                  <Text strong>{totals.totalCrawlerHsdPerRpm > 0 ? truncateToFixed(totals.totalCrawlerHsdPerRpm, 2) : '-'}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={13}>
                  <Text strong>{totals.totalCompHsdPerRpm > 0 ? truncateToFixed(totals.totalCompHsdPerRpm, 2) : '-'}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={14}>
                  <Text strong>{totals.totalHoles || 0}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={15}>
                  <Text strong>{truncateToFixed(totals.totalDepthAvg || 0, 2)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>

          )}
        />
      </Card>

      {/* Services Section - Display outside table */}
      {productionData.some(entry => entry.services && entry.services.length > 0) && (
        <Card>
          <Title level={4}>Services Performed</Title>
          <Table
            dataSource={productionData.filter(entry => entry.services && entry.services.length > 0)}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              {
                title: "Date",
                dataIndex: "date",
                key: "date",
                render: (date) => dayjs(date).format("DD/MM/YYYY"),
              },
              {
                title: "Shift",
                dataIndex: "shift",
                key: "shift",
                width: 80,
                render: (shift) => shift || 1,
              },
              {
                title: "Site",
                dataIndex: ["site", "siteName"],
                key: "site",
                width: 150,
                render: (value, record) => {
                  // Try site object first, then fallback to sites array lookup
                  if (record.site?.siteName) {
                    return record.site.siteName;
                  }
                  if (record.siteId) {
                    const site = sites.find(s => s.id === record.siteId);
                    return site?.siteName || '-';
                  }
                  return '-';
                },
              },
              {
                title: "Machine",
                key: "machine",
                render: (_, record) => {
                  const machine = record.vehicle || machines.find(m => m.id === record.vehicleId);
                  if (!machine) return '-';
                  const name = machine.vehicleType || 'Machine';
                  const number = machine.vehicleNumber || '';
                  return number ? name + ' (' + number + ')' : name;
                }
              },
              {
                title: "Comp",
                key: "compressor",
                render: (_, record) => {
                  if (!record.compressorId) return '-';
                  const compressor = compressors.find(c => c.id === record.compressorId);
                  return compressor?.compressorName || '-';
                }
              },
              {
                title: "Services",
                key: "services",
                render: (_, record) => {
                  const services = record.services || [];
                  if (services.length === 0) return <Text type="secondary">None</Text>;
                  
                  return (
                    <div>
                      {services.map((service, index) => {
                        const serviceTypeLabel = service.serviceType === 'vehicle' ? 'Vehicle' : 
                                               service.serviceType === 'compressor' ? 'Compressor' : 'Item';
                        const serviceName = service.serviceName || 'Unnamed Service';
                        return (
                          <div key={index} style={{ marginBottom: '4px' }}>
                            <Text>
                              <Text strong>{serviceTypeLabel}:</Text> {serviceName}
                              {service.nextServiceRPM && (
                                <Text type="secondary" style={{ marginLeft: '12px' }}>
                                  | Next Service: {truncateToFixed(service.nextServiceRPM, 2)} RPM
                                </Text>
                              )}
                            </Text>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              },
              {
                title: "Vehicle Next Service",
                key: "vehicleNextService",
                render: (_, record) => {
                  const machine = record.vehicle || machines.find(m => m.id === record.vehicleId);
                  return machine?.nextServiceRPM ? truncateToFixed(machine.nextServiceRPM, 2) + ' RPM' : '-';
                }
              },
              {
                title: "Comp Next Service",
                key: "compressorNextService",
                render: (_, record) => {
                  if (!record.compressorId) return '-';
                  const compressor = compressors.find(c => c.id === record.compressorId);
                  return compressor?.nextServiceRPM ? truncateToFixed(compressor.nextServiceRPM, 2) + ' RPM' : '-';
                }
              },
            ]}
          />
        </Card>
      )}

      {/* Detail Modal - Show Employees */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
            <span>Entry Details</span>
          </Space>
        }
        open={showDetailModal}
        onCancel={() => {
          setShowDetailModal(false);
          setSelectedEntry(null);
        }}
        footer={[
          <Button key="close" onClick={() => setShowDetailModal(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {selectedEntry && (
          <div>
            {/* Entry Information */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Text strong>Date:</Text>
                  <div>{dayjs(selectedEntry.date).format('DD MMM YYYY')}</div>
                </Col>
                <Col span={6}>
                  <Text strong>Shift:</Text>
                  <div><Tag>{selectedEntry.shift || 1}</Tag></div>
                </Col>
                <Col span={6}>
                  <Text strong>Ref No:</Text>
                  <div>{selectedEntry.refNo || '-'}</div>
                </Col>
                <Col span={6}>
                  <Text strong>Site:</Text>
                  <div>
                    {selectedEntry.site?.siteName || 
                     sites.find(s => s.id === selectedEntry.siteId)?.siteName || 
                     '-'}
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Machine & Compressor Info */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Machine:</Text>
                  <div>
                    {selectedEntry.vehicle ? 
                      `${selectedEntry.vehicle.vehicleType} (${selectedEntry.vehicle.vehicleNumber})` :
                      machines.find(m => m.id === selectedEntry.vehicleId) ? 
                        `${machines.find(m => m.id === selectedEntry.vehicleId).vehicleType} (${machines.find(m => m.id === selectedEntry.vehicleId).vehicleNumber})` :
                        '-'
                    }
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Opening: {truncateToFixed(selectedEntry.vehicleOpeningRPM || 0, 2)} | 
                      Closing: {truncateToFixed(selectedEntry.vehicleClosingRPM || 0, 2)}
                    </Text>
                  </div>
                </Col>
                <Col span={12}>
                  <Text strong>Compressor:</Text>
                  <div>
                    {selectedEntry.compressorId ? 
                      (compressors.find(c => c.id === selectedEntry.compressorId)?.compressorName || '-') :
                      '-'
                    }
                  </div>
                  {selectedEntry.compressorId && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Opening: {truncateToFixed(selectedEntry.compressorOpeningRPM || 0, 2)} | 
                        Closing: {truncateToFixed(selectedEntry.compressorClosingRPM || 0, 2)}
                      </Text>
                    </div>
                  )}
                </Col>
              </Row>
            </Card>

            {/* Employees Table */}
            <div>
              <Title level={5}>Employees</Title>
              <Table
                dataSource={selectedEntry.employees || []}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: 'Employee ID',
                    dataIndex: 'empId',
                    key: 'empId',
                    width: '25%',
                  },
                  {
                    title: 'Name',
                    dataIndex: 'name',
                    key: 'name',
                    width: '35%',
                  },
                  {
                    title: 'Role',
                    key: 'role',
                    width: '20%',
                    render: (_, record) => {
                      const role = record.role || record.DailyEntryEmployee?.role || 'operator';
                      return (
                        <Tag color={role === 'operator' ? 'blue' : 'green'}>
                          {role === 'operator' ? 'Operator' : 'Helper'}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: 'Shift',
                    key: 'shift',
                    width: '20%',
                    render: (_, record) => {
                      const shift = record.shift || record.DailyEntryEmployee?.shift || 1;
                      return <Tag>{shift}</Tag>;
                    },
                  },
                ]}
                locale={{ emptyText: 'No employees assigned' }}
              />
            </div>

            {/* Production Metrics */}
            <Card size="small" style={{ marginTop: 16 }}>
              <Title level={5}>Production Metrics</Title>
              <Row gutter={16}>
                <Col span={8}>
                  <Text strong>Meter:</Text> {truncateToFixed(selectedEntry.meter || 0, 2)}
                </Col>
                <Col span={8}>
                  <Text strong>Holes:</Text> {selectedEntry.noOfHoles || 0}
                </Col>
                <Col span={8}>
                  <Text strong>Total HSD:</Text> {Math.round(selectedEntry.totalHSD || 0)}
                </Col>
              </Row>
            </Card>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default ProductionReport;
