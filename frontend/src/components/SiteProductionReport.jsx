// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Table,
  DatePicker,
  Button,
  Typography,
  Space,
  message,
} from "antd";
import {
  FilePdfOutlined,
  FileExcelOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";
import api from "../service/api";
import { truncateToFixed } from "../utils/textUtils";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const SiteProductionReport = () => {
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState([]);
  const [machines, setMachines] = useState([]);
  const [compressors, setCompressors] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedSiteName, setSelectedSiteName] = useState('');
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'days'), dayjs()]);
  const [aggregatedData, setAggregatedData] = useState([]);
  const [totals, setTotals] = useState({});
  const navigate = useNavigate();

  // Fetch sites on mount
  useEffect(() => {
    fetchSites();
    fetchMachines();
    fetchCompressors();
  }, []);

  const fetchSites = async () => {
    try {
      const res = await api.get('/api/sites?limit=1000');
      setSites(res.data.data || []);
    } catch (err) {
      console.error("Error fetching sites", err);
      message.error("Error fetching sites");
    }
  };

  const fetchMachines = async () => {
    try {
      const res = await api.get('/api/vehicles?limit=1000');
      setMachines(res.data.data || []);
    } catch (err) {
      console.error("Error fetching machines", err);
    }
  };

  const fetchCompressors = async () => {
    try {
      const res = await api.get('/api/compressors?limit=1000');
      setCompressors(res.data.data || []);
    } catch (err) {
      console.error("Error fetching compressors", err);
    }
  };

  // Aggregate all entries by date
  const aggregateDataByDate = (entries, machinesList = machines, compressorsList = compressors) => {
    // Group entries by date
    const dateGroups = {};
    
    entries.forEach(entry => {
      const dateKey = dayjs(entry.date).format('YYYY-MM-DD');
      
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = {
          date: entry.date,
          site: entry.site,
          siteId: entry.siteId,
          entries: []
        };
      }
      
      dateGroups[dateKey].entries.push(entry);
    });

    // Calculate aggregated values for each date
    const aggregated = Object.values(dateGroups).map(group => {
      let totalCrawlerHSD = 0;
      let totalCamperHSD = 0;
      let totalCompressorHSD = 0;
      let totalMeter = 0;
      let totalCrawlerRPM = 0;
      let totalCompressorRPM = 0;
      let totalHoles = 0;

      group.entries.forEach(entry => {
        const vehicleHSD = parseFloat(entry.vehicleHSD) || 0;
        const meter = parseFloat(entry.meter) || 0;
        const vehicleRPM = (parseFloat(entry.vehicleClosingRPM) || 0) - (parseFloat(entry.vehicleOpeningRPM) || 0);
        const compressorRPM = (parseFloat(entry.compressorClosingRPM) || 0) - (parseFloat(entry.compressorOpeningRPM) || 0);
        const holes = parseFloat(entry.noOfHoles) || 0;
        const compressorHSD = parseFloat(entry.compressorHSD) || 0;

        const machineTypeSrc = (entry.machine?.vehicleType) || (entry.vehicle?.vehicleType) || (machinesList.find(m => m.id === entry.vehicleId)?.vehicleType) || '';
        const machineType = machineTypeSrc.toString().trim().toLowerCase();
        const isCrawler = machineType === 'crawler' || machineType.includes('crawler');
        const isCamper = machineType === 'camper' || machineType.includes('camper') || machineType.includes('truck');

        if (isCrawler) {
          totalCrawlerHSD += vehicleHSD;
          totalCrawlerRPM += vehicleRPM;
        } else if (isCamper) {
          totalCamperHSD += vehicleHSD;
        }

        totalCompressorHSD += compressorHSD;
        totalMeter += meter;
        totalCompressorRPM += compressorRPM;
        totalHoles += holes;
      });

      const totalHSD = parseFloat((totalCrawlerHSD + totalCamperHSD + totalCompressorHSD).toFixed(2));
      const hsdMtr = totalMeter > 0 ? parseFloat((totalHSD / totalMeter).toFixed(2)) : 0;
      const mtrRPM = totalCompressorRPM > 0 ? parseFloat((totalMeter / totalCompressorRPM).toFixed(2)) : 0;
      const crawlerHsdPerRpm = totalCrawlerRPM > 0 ? parseFloat((totalCrawlerHSD / totalCrawlerRPM).toFixed(2)) : 0;
      const compHsdPerRpm = totalCompressorRPM > 0 ? parseFloat((totalCompressorHSD / totalCompressorRPM).toFixed(2)) : 0;
      const depthAvg = totalHoles > 0 ? parseFloat((totalMeter / totalHoles).toFixed(2)) : 0;

      return {
        date: group.date,
        site: group.site,
        siteId: group.siteId,
        meter: parseFloat(totalMeter.toFixed(2)),
        crawlerHSD: parseFloat(totalCrawlerHSD.toFixed(2)),
        camperHSD: parseFloat(totalCamperHSD.toFixed(2)),
        compressorHSD: parseFloat(totalCompressorHSD.toFixed(2)),
        totalHSD,
        crawlerRPM: parseFloat(totalCrawlerRPM.toFixed(2)),
        compressorRPM: parseFloat(totalCompressorRPM.toFixed(2)),
        hsdMtr,
        mtrRPM,
        crawlerHsdPerRpm,
        compHsdPerRpm,
        holes: parseFloat(totalHoles.toFixed(2)),
        depthAvg,
        isCrawler: totalCrawlerHSD > 0,
        isCamper: totalCamperHSD > 0,
        crawlerHSDDisplay: totalCrawlerHSD > 0 ? totalCrawlerHSD : '-',
        camperHSDDisplay: totalCamperHSD > 0 ? totalCamperHSD : '-',
        crawlerRPMDisplay: totalCrawlerRPM > 0 ? totalCrawlerRPM : '-',
      };
    });

    // Sort by date ascending
    aggregated.sort((a, b) => {
      const dateA = dayjs(a.date);
      const dateB = dayjs(b.date);
      return dateA.isBefore(dateB) ? -1 : dateA.isAfter(dateB) ? 1 : 0;
    });

    // Calculate totals
    const totals = {
      totalCrawlerHSD: parseFloat(aggregated.reduce((sum, d) => sum + d.crawlerHSD, 0).toFixed(2)),
      totalCamperHSD: parseFloat(aggregated.reduce((sum, d) => sum + d.camperHSD, 0).toFixed(2)),
      totalCompressorHSD: parseFloat(aggregated.reduce((sum, d) => sum + d.compressorHSD, 0).toFixed(2)),
      totalTotalHSD: parseFloat(aggregated.reduce((sum, d) => sum + d.totalHSD, 0).toFixed(2)),
      totalMeter: parseFloat(aggregated.reduce((sum, d) => sum + d.meter, 0).toFixed(2)),
      totalCrawlerRPM: parseFloat(aggregated.reduce((sum, d) => sum + d.crawlerRPM, 0).toFixed(2)),
      totalCompressorRPM: parseFloat(aggregated.reduce((sum, d) => sum + d.compressorRPM, 0).toFixed(2)),
      totalHoles: parseFloat(aggregated.reduce((sum, d) => sum + d.holes, 0).toFixed(2)),
      totalHsdMtr: aggregated.reduce((sum, d) => sum + d.meter, 0) > 0 
        ? parseFloat((aggregated.reduce((sum, d) => sum + d.totalHSD, 0) / aggregated.reduce((sum, d) => sum + d.meter, 0)).toFixed(2)) 
        : 0,
      totalMtrRPM: aggregated.reduce((sum, d) => sum + d.compressorRPM, 0) > 0 
        ? parseFloat((aggregated.reduce((sum, d) => sum + d.meter, 0) / aggregated.reduce((sum, d) => sum + d.compressorRPM, 0)).toFixed(2)) 
        : 0,
      totalCrawlerHsdPerRpm: aggregated.reduce((sum, d) => sum + d.crawlerRPM, 0) > 0 
        ? parseFloat((aggregated.reduce((sum, d) => sum + d.crawlerHSD, 0) / aggregated.reduce((sum, d) => sum + d.crawlerRPM, 0)).toFixed(2)) 
        : 0,
      totalCompHsdPerRpm: aggregated.reduce((sum, d) => sum + d.compressorRPM, 0) > 0 
        ? parseFloat((aggregated.reduce((sum, d) => sum + d.compressorHSD, 0) / aggregated.reduce((sum, d) => sum + d.compressorRPM, 0)).toFixed(2)) 
        : 0,
      totalDepthAvg: aggregated.reduce((sum, d) => sum + d.holes, 0) > 0 
        ? parseFloat((aggregated.reduce((sum, d) => sum + d.meter, 0) / aggregated.reduce((sum, d) => sum + d.holes, 0)).toFixed(2)) 
        : 0,
    };

    return { aggregated, totals };
  };

  // Fetch and aggregate production data
  const fetchProductionData = async () => {
    if (!selectedSite || !dateRange[0] || !dateRange[1]) {
      message.warning("Please select a site and date range");
      return;
    }

    setLoading(true);
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      // If selectedSite is 'all', don't filter by siteId
      const url = selectedSite === 'all' 
        ? `/api/dailyEntries?startDate=${startDate}&endDate=${endDate}&limit=10000`
        : `/api/dailyEntries?siteId=${selectedSite}&startDate=${startDate}&endDate=${endDate}&limit=10000`;

      const res = await api.get(url);
      let entries = res.data.data || [];

      // Fetch machines and compressors for entries if needed
      let currentMachines = machines;
      let currentCompressors = compressors;
      
      if (machines.length === 0) {
        try {
          const machinesRes = await api.get('/api/vehicles?limit=1000');
          currentMachines = machinesRes.data.data || [];
          setMachines(currentMachines);
        } catch (err) {
          console.warn('Could not fetch machines:', err);
        }
      }
      
      if (compressors.length === 0) {
        try {
          const compressorsRes = await api.get('/api/compressors?limit=1000');
          currentCompressors = compressorsRes.data.data || [];
          setCompressors(currentCompressors);
        } catch (err) {
          console.warn('Could not fetch compressors:', err);
        }
      }
      
      const { aggregated, totals } = aggregateDataByDate(entries, currentMachines, currentCompressors);
      setAggregatedData(aggregated);
      setTotals(totals);
    } catch (err) {
      console.error("Error fetching production data", err);
      message.error("Error fetching production data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when site or date range changes
  useEffect(() => {
    if (selectedSite && dateRange[0] && dateRange[1]) {
      fetchProductionData();
    }
  }, [selectedSite, dateRange]);

  // Handle site selection
  const handleSiteSelect = (site) => {
    if (site === 'all') {
      setSelectedSite('all');
      setSelectedSiteName('All Sites');
    } else {
      setSelectedSite(site.id);
      setSelectedSiteName(site.siteName);
    }
    setAggregatedData([]);
    setTotals({});
  };

  // Handle back to site selection
  const handleBack = () => {
    setSelectedSite(null);
    setSelectedSiteName('');
    setAggregatedData([]);
    setTotals({});
  };

  // Table columns
  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (date) => dayjs(date).format("DD/MM/YYYY"),
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
      render: (value, record) => record.isCrawler ? Math.round(value || 0) : '-',
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
      render: (value, record) => record.isCamper ? Math.round(value || 0) : '-',
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
      render: (value, record) => record.isCrawler ? truncateToFixed(value || 0, 2) : '-',
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
      render: (value, record) => record.isCrawler && value > 0 ? truncateToFixed(value, 2) : '-',
    },
    {
      title: "Comp HSD/Comp RPM",
      dataIndex: "compHsdPerRpm",
      key: "compHsdPerRpm",
      render: (value) => value > 0 ? truncateToFixed(value, 2) : '-',
    },
    {
      title: "Number of Holes",
      dataIndex: "holes",
      key: "holes",
      render: (value) => value || 0,
    },
    {
      title: "Depth Avg",
      dataIndex: "depthAvg",
      key: "depthAvg",
      render: (value) => truncateToFixed(value || 0, 2),
    },
  ];

  // Export to Excel
  const exportToExcel = async () => {
    setLoading(true);
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      // If selectedSite is 'all', don't filter by siteId
      const url = selectedSite === 'all' 
        ? `/api/dailyEntries?startDate=${startDate}&endDate=${endDate}&limit=10000`
        : `/api/dailyEntries?siteId=${selectedSite}&startDate=${startDate}&endDate=${endDate}&limit=10000`;

      const res = await api.get(url);
      let entries = res.data.data || [];

      // Fetch machines and compressors if needed
      let excelMachines = machines;
      let excelCompressors = compressors;
      let excelSites = sites;

      if (machines.length === 0) {
        try {
          const machinesRes = await api.get('/api/vehicles?limit=1000');
          excelMachines = machinesRes.data.data || [];
        } catch (err) {
          console.warn('Could not fetch machines for Excel:', err);
        }
      }

      if (compressors.length === 0) {
        try {
          const compressorsRes = await api.get('/api/compressors?limit=1000');
          excelCompressors = compressorsRes.data.data || [];
        } catch (err) {
          console.warn('Could not fetch compressors for Excel:', err);
        }
      }

      if (sites.length === 0) {
        try {
          const sitesRes = await api.get('/api/sites?limit=1000');
          excelSites = sitesRes.data.data || [];
        } catch (err) {
          console.warn('Could not fetch sites for Excel:', err);
        }
      }

      const { aggregated, totals } = aggregateDataByDate(entries, excelMachines, excelCompressors);

      // Prepare Excel data
      const periodStart = dateRange[0].format("DD/MM/YYYY");
      const periodEnd = dateRange[1].format("DD/MM/YYYY");
      const siteName = selectedSiteName || 'All Sites';
      const generatedDate = new Date().toLocaleDateString();

      // Create worksheet data with simplified header
      // First row: Generated date on left, site name centered (column 7 out of 14)
      const headerRow = new Array(14).fill(''); // 14 columns total
      headerRow[0] = `Generated on: ${generatedDate}`;
      headerRow[6] = siteName; // Center the site name (column 7, index 6)
      
      const worksheetData = [
        headerRow,
        [], // Empty row
        [
          'Date',
          'Meter',
          'Crawler HSD',
          'Comp HSD',
          'Camper HSD',
          'Total HSD',
          'Crawler RPM',
          'Comp RPM',
          'HSD/MTR',
          'MTR/RPM',
          'Crawler HSD/Crawler RPM',
          'Comp HSD/Comp RPM',
          'Number of Holes',
          'Depth Avg'
        ],
      ];

      // Add data rows
      aggregated.forEach((entry) => {
        worksheetData.push([
          dayjs(entry.date).format("DD/MM/YYYY"),
          truncateToFixed(entry.meter || 0, 2),
          entry.isCrawler ? Math.round(entry.crawlerHSD || 0) : '-',
          Math.round(entry.compressorHSD || 0),
          entry.isCamper ? Math.round(entry.camperHSD || 0) : '-',
          Math.round(entry.totalHSD || 0),
          entry.isCrawler ? truncateToFixed(entry.crawlerRPM || 0, 2) : '-',
          truncateToFixed(entry.compressorRPM || 0, 2),
          truncateToFixed(entry.hsdMtr || 0, 2),
          truncateToFixed(entry.mtrRPM || 0, 2),
          entry.isCrawler && entry.crawlerHsdPerRpm > 0 ? truncateToFixed(entry.crawlerHsdPerRpm, 2) : '-',
          entry.compHsdPerRpm > 0 ? truncateToFixed(entry.compHsdPerRpm, 2) : '-',
          entry.holes || 0,
          truncateToFixed(entry.depthAvg || 0, 2),
        ]);
      });

      // Add totals row
      worksheetData.push([]); // Empty row
      worksheetData.push([
        'Total',
        truncateToFixed(totals.totalMeter || 0, 2),
        totals.totalCrawlerRPM > 0 ? Math.round(totals.totalCrawlerHSD || 0) : '-',
        Math.round(totals.totalCompressorHSD || 0),
        totals.totalCamperHSD > 0 ? Math.round(totals.totalCamperHSD || 0) : '-',
        Math.round(totals.totalTotalHSD || 0),
        totals.totalCrawlerRPM > 0 ? truncateToFixed(totals.totalCrawlerRPM || 0, 2) : '-',
        truncateToFixed(totals.totalCompressorRPM || 0, 2),
        truncateToFixed(totals.totalHsdMtr || 0, 2),
        truncateToFixed(totals.totalMtrRPM || 0, 2),
        totals.totalCrawlerHsdPerRpm > 0 ? truncateToFixed(totals.totalCrawlerHsdPerRpm, 2) : '-',
        totals.totalCompHsdPerRpm > 0 ? truncateToFixed(totals.totalCompHsdPerRpm, 2) : '-',
        totals.totalHoles || 0,
        truncateToFixed(totals.totalDepthAvg || 0, 2),
      ]);

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 10 }, // Meter
        { wch: 12 }, // Crawler HSD
        { wch: 12 }, // Comp HSD
        { wch: 12 }, // Camper HSD
        { wch: 12 }, // Total HSD
        { wch: 12 }, // Crawler RPM
        { wch: 12 }, // Comp RPM
        { wch: 12 }, // HSD/MTR
        { wch: 12 }, // MTR/RPM
        { wch: 20 }, // Crawler HSD/Crawler RPM
        { wch: 20 }, // Comp HSD/Comp RPM
        { wch: 15 }, // Number of Holes
        { wch: 12 }, // Depth Avg
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Site Production Report");

      // Generate filename
      const filename = `Site_Production_Report_${siteName.replace(/\s+/g, '_')}_${periodStart.replace(/\//g, '-')}_${periodEnd.replace(/\//g, '-')}.xlsx`;

      // Write file
      XLSX.writeFile(wb, filename);

      message.success("Excel file exported successfully");
    } catch (err) {
      console.error("Error exporting to Excel", err);
      message.error("Error exporting to Excel");
    } finally {
      setLoading(false);
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    setLoading(true);
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      // If selectedSite is 'all', don't filter by siteId
      const url = selectedSite === 'all' 
        ? `/api/dailyEntries?startDate=${startDate}&endDate=${endDate}&limit=10000`
        : `/api/dailyEntries?siteId=${selectedSite}&startDate=${startDate}&endDate=${endDate}&limit=10000`;

      const res = await api.get(url);
      let entries = res.data.data || [];

      // Fetch machines and compressors if needed
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

      const { aggregated, totals } = aggregateDataByDate(entries, pdfMachines, pdfCompressors);

      const printWindow = window.open("", "_blank");
      const generatedDate = new Date().toLocaleDateString();

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Site Production Report - ${selectedSiteName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .header-left { text-align: left; }
            .header-center { text-align: center; flex: 1; font-size: 18px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">Generated on: ${generatedDate}</div>
            <div class="header-center">${selectedSiteName}</div>
            <div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Meter</th>
                <th>Crawler HSD</th>
                <th>Comp HSD</th>
                <th>Camper HSD</th>
                <th>Total HSD</th>
                <th>Crawler RPM</th>
                <th>Comp RPM</th>
                <th>HSD/MTR</th>
                <th>MTR/RPM</th>
                <th>Crawler HSD/Crawler RPM</th>
                <th>Comp HSD/Comp RPM</th>
                <th>Number of Holes</th>
                <th>Depth Avg</th>
              </tr>
            </thead>
            <tbody>
              ${aggregated.map((entry) => {
                return `
                  <tr>
                    <td>${dayjs(entry.date).format("DD/MM/YYYY")}</td>
                    <td>${truncateToFixed(entry.meter || 0, 2)}</td>
                    <td>${entry.isCrawler ? Math.round(entry.crawlerHSD || 0) : '-'}</td>
                    <td>${Math.round(entry.compressorHSD || 0)}</td>
                    <td>${entry.isCamper ? Math.round(entry.camperHSD || 0) : '-'}</td>
                    <td>${Math.round(entry.totalHSD || 0)}</td>
                    <td>${entry.isCrawler ? truncateToFixed(entry.crawlerRPM || 0, 2) : '-'}</td>
                    <td>${truncateToFixed(entry.compressorRPM || 0, 2)}</td>
                    <td>${truncateToFixed(entry.hsdMtr || 0, 2)}</td>
                    <td>${truncateToFixed(entry.mtrRPM || 0, 2)}</td>
                    <td>${entry.isCrawler && entry.crawlerHsdPerRpm > 0 ? truncateToFixed(entry.crawlerHsdPerRpm, 2) : '-'}</td>
                    <td>${entry.compHsdPerRpm > 0 ? truncateToFixed(entry.compHsdPerRpm, 2) : '-'}</td>
                    <td>${entry.holes || 0}</td>
                    <td>${truncateToFixed(entry.depthAvg || 0, 2)}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td>Total</td>
                <td>${truncateToFixed(totals.totalMeter || 0, 2)}</td>
                <td>${totals.totalCrawlerRPM > 0 ? Math.round(totals.totalCrawlerHSD || 0) : '-'}</td>
                <td>${Math.round(totals.totalCompressorHSD || 0)}</td>
                <td>${totals.totalCamperHSD > 0 ? Math.round(totals.totalCamperHSD || 0) : '-'}</td>
                <td>${Math.round(totals.totalTotalHSD || 0)}</td>
                <td>${totals.totalCrawlerRPM > 0 ? truncateToFixed(totals.totalCrawlerRPM || 0, 2) : '-'}</td>
                <td>${truncateToFixed(totals.totalCompressorRPM || 0, 2)}</td>
                <td>${truncateToFixed(totals.totalHsdMtr || 0, 2)}</td>
                <td>${truncateToFixed(totals.totalMtrRPM || 0, 2)}</td>
                <td>${totals.totalCrawlerHsdPerRpm > 0 ? truncateToFixed(totals.totalCrawlerHsdPerRpm, 2) : '-'}</td>
                <td>${totals.totalCompHsdPerRpm > 0 ? truncateToFixed(totals.totalCompHsdPerRpm, 2) : '-'}</td>
                <td>${totals.totalHoles || 0}</td>
                <td>${truncateToFixed(totals.totalDepthAvg || 0, 2)}</td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.print();
    } catch (err) {
      console.error("Error exporting to PDF", err);
      message.error("Error exporting to PDF");
    } finally {
      setLoading(false);
    }
  };

  // Show site cards if no site selected
  if (!selectedSite) {
    return (
      <div className="p-4 bg-gray-50 min-h-screen">
        <Title level={2}>Site Production Report</Title>
        <Text type="secondary" className="block mb-4">
          Select a site to view aggregated production data
        </Text>
        <Row gutter={[24, 24]}>
          {/* All Sites button - appears first */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              className="text-center h-full"
              style={{
                border: '2px solid #52c41a',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                backgroundColor: '#f6ffed',
              }}
              bodyStyle={{ padding: '24px' }}
              onClick={() => handleSiteSelect('all')}
            >
              <div
                className="mb-4"
                style={{
                  fontSize: "3rem",
                  color: "#52c41a",
                  marginBottom: "1.5rem"
                }}
              >
                🌐
              </div>
              <Title level={4} className="mb-3" style={{ color: "#52c41a" }}>
                All Sites
              </Title>
              <Button
                type="primary"
                style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
                className="w-full"
                onClick={() => handleSiteSelect('all')}
              >
                View All Sites Report
              </Button>
            </Card>
          </Col>
          {sites.map((site) => (
            <Col xs={24} sm={12} lg={6} key={site.id}>
              <Card
                hoverable
                className="text-center h-full"
                style={{
                  border: '2px solid #1890ff20',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
                bodyStyle={{ padding: '24px' }}
                onClick={() => handleSiteSelect(site)}
              >
                <div
                  className="mb-4"
                  style={{
                    fontSize: "3rem",
                    color: "#1890ff",
                    marginBottom: "1.5rem"
                  }}
                >
                  📊
                </div>
                <Title level={4} className="mb-3" style={{ color: "#1890ff" }}>
                  {site.siteName}
                </Title>
                <Button
                  type="primary"
                  style={{ backgroundColor: "#1890ff", borderColor: "#1890ff" }}
                  className="w-full"
                  onClick={() => handleSiteSelect(site)}
                >
                  View Report
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  // Show aggregated data table
  return (
    <div className="space-y-2">
      {/* Header */}
      <Card className="mb-2" bodyStyle={{ padding: '8px' }}>
        <Row gutter={8} align="middle">
          <Col xs={24} sm={6}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
              size="small"
            >
              Back to Sites
            </Button>
          </Col>
          <Col xs={24} sm={12}>
            <Title level={4} style={{ margin: 0 }}>
              {selectedSiteName} - Production Report
            </Title>
          </Col>
        </Row>
      </Card>

      {/* Filters */}
      <Card className="mb-2" bodyStyle={{ padding: '8px' }}>
        <Row gutter={8} align="middle">
          <Col xs={24} sm={8}>
            <Text strong>Date Range:</Text>
            <RangePicker
              className="w-full mt-1"
              value={dateRange}
              onChange={(dates) => setDateRange(dates || [dayjs().subtract(30, 'days'), dayjs()])}
              format="DD/MM/YYYY"
              size="small"
            />
          </Col>
          <Col xs={24} sm={6} md={2}>
            <Button
              icon={<FileExcelOutlined />}
              onClick={exportToExcel}
              type="default"
              size="small"
              className="w-full"
              loading={loading}
            >
              Excel
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
              loading={loading}
            >
              PDF
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Aggregated Data Table */}
      <Card>
        <Table
          dataSource={aggregatedData}
          columns={columns}
          rowKey={(record) => `${record.date}-${record.siteId}`}
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 1200 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <Text strong>{truncateToFixed(totals.totalMeter || 0, 2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <Text strong>{totals.totalCrawlerRPM > 0 ? Math.round(totals.totalCrawlerHSD || 0) : '-'}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3}>
                  <Text strong>{Math.round(totals.totalCompressorHSD || 0)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4}>
                  <Text strong>{totals.totalCamperHSD > 0 ? Math.round(totals.totalCamperHSD || 0) : '-'}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5}>
                  <Text strong>{Math.round(totals.totalTotalHSD || 0)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6}>
                  <Text strong>{totals.totalCrawlerRPM > 0 ? truncateToFixed(totals.totalCrawlerRPM || 0, 2) : '-'}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7}>
                  <Text strong>{truncateToFixed(totals.totalCompressorRPM || 0, 2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8}>
                  <Text strong>{truncateToFixed(totals.totalHsdMtr || 0, 2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={9}>
                  <Text strong>{truncateToFixed(totals.totalMtrRPM || 0, 2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={10}>
                  <Text strong>{totals.totalCrawlerHsdPerRpm > 0 ? truncateToFixed(totals.totalCrawlerHsdPerRpm, 2) : '-'}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={11}>
                  <Text strong>{totals.totalCompHsdPerRpm > 0 ? truncateToFixed(totals.totalCompHsdPerRpm, 2) : '-'}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={12}>
                  <Text strong>{totals.totalHoles || 0}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={13}>
                  <Text strong>{truncateToFixed(totals.totalDepthAvg || 0, 2)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  );
};

export default SiteProductionReport;

