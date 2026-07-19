import React, { useState, useEffect } from 'react';
import { Upload, X, ShieldAlert, Activity, FileDown, Sparkles } from 'lucide-react';
import './index.css';

function App() {
  const [file, setFile] = useState(null);
  const [rules, setRules] = useState([]);
  const [ruleType, setRuleType] = useState('app');
  const [ruleValue, setRuleValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);
  const [aiInsights, setAiInsights] = useState([]);

  // Generate AI Insights when report updates
  useEffect(() => {
    if (report) {
      const insights = [];
      
      // Analyze Drop Rate
      const total = report.totalPackets;
      const dropped = report.dropped;
      if (total > 0) {
        const dropRate = (dropped / total) * 100;
        if (dropRate > 20) {
          insights.push("High drop rate detected (" + dropRate.toFixed(1) + "%). Consider reviewing your blocking rules to ensure they aren't overly aggressive.");
        }
      }

      // Analyze Apps
      const apps = report.appStats || [];
      const unknownApp = apps.find(a => a.app === 'Unknown' || a.app === 'HTTPS');
      if (unknownApp && parseInt(unknownApp.count) > (total * 0.4)) {
        insights.push(`Over 40% of traffic is classified as ${unknownApp.app}. We recommend adding domain-based blocking rules for more granular control.`);
      }

      // Recommend next steps
      if (insights.length === 0) {
        insights.push("Traffic looks healthy. No significant anomalies detected by the AI engine.");
      } else {
        insights.push("Consider enabling active flow tracking for real-time monitoring of these anomalies.");
      }

      setAiInsights(insights);
    }
  }, [report]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setReport(null);
      setDownloadUrl(null);
    }
  };

  const addRule = () => {
    if (!ruleValue.trim()) return;
    setRules([...rules, { type: ruleType, value: ruleValue.trim() }]);
    setRuleValue('');
  };

  const removeRule = (index) => {
    const newRules = [...rules];
    newRules.splice(index, 1);
    setRules(newRules);
  };

  const startInspection = async () => {
    if (!file) {
      setError("Please upload a PCAP file first.");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('pcap', file);
    formData.append('rules', JSON.stringify(rules));
    
    try {
      const response = await fetch('http://localhost:3000/api/inspect', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Inspection failed');
      }
      
      setReport(data.report);
      setDownloadUrl(`http://localhost:3000${data.downloadUrl}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Deep Packet Engine</h1>
        <p>Advanced real-time inspection, classification and filtering of network traffic.</p>
      </header>
      
      <main className="dashboard-grid">
        {/* Left Column - Configuration */}
        <div className="config-column">
          <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Upload size={24} color="var(--primary-color)" /> Capture Upload
            </h2>
            
            <label className="upload-zone" style={{ display: 'block' }}>
              <input 
                type="file" 
                accept=".pcap" 
                onChange={handleFileChange} 
                style={{ display: 'none' }}
              />
              <div className="upload-icon">
                <Upload size={48} />
              </div>
              <h3>{file ? file.name : "Drag & Drop PCAP file here"}</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>or click to browse</p>
            </label>
          </div>
          
          <div className="glass-panel">
            <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={24} color="var(--secondary-color)" /> Blocking Rules
            </h2>
            
            <div className="add-rule-form">
              <select 
                className="select-field"
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value)}
              >
                <option value="app">App</option>
                <option value="domain">Domain</option>
                <option value="ip">IP</option>
              </select>
              
              <input 
                type="text" 
                className="input-field" 
                placeholder={`E.g. ${ruleType === 'app' ? 'YouTube' : ruleType === 'domain' ? 'example.com' : '192.168.1.1'}`}
                value={ruleValue}
                onChange={(e) => setRuleValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRule()}
              />
              
              <button className="btn" onClick={addRule}>Add</button>
            </div>
            
            <div className="rules-list">
              {rules.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '1rem' }}>No active rules.</p>}
              {rules.map((rule, idx) => (
                <div key={idx} className="rule-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="rule-badge">{rule.type}</span>
                    <span>{rule.value}</span>
                  </div>
                  <button className="rule-remove" onClick={() => removeRule(idx)}>
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <button 
                className="btn" 
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={startInspection}
                disabled={isProcessing || !file}
              >
                {isProcessing ? 'Processing...' : 'Run DPI Engine'}
              </button>
              {error && <p style={{ color: 'var(--danger-color)', marginTop: '1rem' }}>{error}</p>}
            </div>
          </div>
        </div>
        
        {/* Right Column - Dashboard */}
        <div className="report-column">
          <div className="glass-panel" style={{ height: '100%' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={24} color="#10b981" /> Inspection Report
            </h2>
            
            {!report && !isProcessing && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', paddingTop: '4rem' }}>
                <Activity size={64} opacity={0.2} style={{ marginBottom: '1rem', margin: '0 auto', display: 'block' }} />
                <p>Run the engine to see the report.</p>
              </div>
            )}
            
            {isProcessing && (
              <div style={{ textAlign: 'center', color: 'var(--primary-color)', paddingTop: '4rem' }}>
                <div className="spinner" style={{ 
                  width: '40px', height: '40px', border: '4px solid rgba(99, 102, 241, 0.2)', 
                  borderTop: '4px solid var(--primary-color)', borderRadius: '50%', 
                  animation: 'spin 1s linear infinite', margin: '0 auto 1rem' 
                }}></div>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <p>Analyzing packets...</p>
              </div>
            )}
            
            {report && !isProcessing && (
              <div className="report-content animate-in">
                <style>{`.animate-in { animation: fadeIn 0.5s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Total Packets</div>
                    <div className="stat-value">{report.totalPackets}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Active Flows</div>
                    <div className="stat-value">{report.activeFlows}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Forwarded</div>
                    <div className="stat-value" style={{ background: 'linear-gradient(to right, #34d399, #10b981)', WebkitBackgroundClip: 'text' }}>{report.forwarded}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Dropped</div>
                    <div className="stat-value" style={{ background: 'linear-gradient(to right, #f87171, #ef4444)', WebkitBackgroundClip: 'text' }}>{report.dropped}</div>
                  </div>
                </div>
                
                {report.appStats.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>App Breakdown</h3>
                    {report.appStats.map((stat, i) => (
                      <div key={i} className="app-stat-item">
                        <div className="app-stat-header">
                          <span style={{ fontWeight: 600 }}>{stat.app}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{stat.count} ({stat.percentage})</span>
                        </div>
                        <div className="progress-bar-container">
                          <div className="progress-bar-fill" style={{ width: stat.percentage }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {report.blockedAlerts.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#fca5a5' }}>Blocked Packets</h3>
                    <div className="blocked-list">
                      {report.blockedAlerts.map((alert, i) => (
                        <div key={i} className="blocked-item">{alert}</div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* AI Insights Section */}
                <div className="ai-insights-container">
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={20} className="ai-insight-icon" /> AI Network Insights
                  </h3>
                  
                  {aiInsights.map((insight, idx) => (
                    <div key={idx} className="ai-insight-item">
                      <Sparkles size={16} style={{ color: 'var(--primary-color)', marginTop: '0.2rem' }} />
                      <div className="ai-insight-text">{insight}</div>
                    </div>
                  ))}
                </div>
                
                {downloadUrl && (
                  <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <a href={downloadUrl} download className="btn" style={{ textDecoration: 'none' }}>
                      <FileDown size={20} /> Download Filtered PCAP
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
