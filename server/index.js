const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() + '.pcap');
    }
});

const upload = multer({ storage });

function parseOutput(output) {
    const report = {
        totalPackets: 0,
        forwarded: 0,
        dropped: 0,
        activeFlows: 0,
        appStats: [],
        detectedApps: [],
        blockedAlerts: []
    };

    const lines = output.split('\n');
    let parsingApps = false;
    let parsingDomains = false;

    lines.forEach(line => {
        line = line.trim();
        
        // Parse Blocked Alerts
        if (line.startsWith('[BLOCKED]')) {
            report.blockedAlerts.push(line.replace('[BLOCKED] ', ''));
        }
        
        // Parse main stats
        if (line.includes('Total Packets:')) {
            const match = line.match(/Total Packets:\s+(\d+)/);
            if (match) report.totalPackets = parseInt(match[1]);
        }
        if (line.includes('Forwarded:')) {
            const match = line.match(/Forwarded:\s+(\d+)/);
            if (match) report.forwarded = parseInt(match[1]);
        }
        if (line.includes('Dropped:')) {
            const match = line.match(/Dropped:\s+(\d+)/);
            if (match) report.dropped = parseInt(match[1]);
        }
        if (line.includes('Active Flows:')) {
            const match = line.match(/Active Flows:\s+(\d+)/);
            if (match) report.activeFlows = parseInt(match[1]);
        }
        
        // Parse Apps breakdown
        if (line.includes('APPLICATION BREAKDOWN')) {
            parsingApps = true;
            parsingDomains = false;
        } else if (parsingApps && line.includes('╚════')) {
            parsingApps = false;
        } else if (parsingApps && line.startsWith('║') && !line.includes('╠════')) {
            // Matches: ║ YOUTUBE            150  15.0% ####          ║
            // We can extract simply by taking parts
            const cleanLine = line.replace(/║/g, '').trim();
            if (cleanLine) {
                const parts = cleanLine.split(/\s{2,}/); // split by multiple spaces
                if (parts.length >= 3) {
                    report.appStats.push({
                        app: parts[0],
                        count: parseInt(parts[1]),
                        percentage: parts[2]
                    });
                }
            }
        }
        
        // Parse Domains
        if (line.includes('[Detected Applications/Domains]')) {
            parsingDomains = true;
            parsingApps = false;
        } else if (parsingDomains && line.startsWith('-')) {
            // - www.youtube.com -> YOUTUBE
            const match = line.match(/-\s+(.*?)\s+->\s+(.*)/);
            if (match) {
                report.detectedApps.push({
                    domain: match[1],
                    app: match[2]
                });
            }
        }
    });

    return report;
}

app.post('/api/inspect', upload.single('pcap'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No PCAP file uploaded' });
    }

    const rules = req.body.rules ? JSON.parse(req.body.rules) : [];
    
    const inputPath = req.file.path;
    const outputFileName = `out_${uuidv4()}.pcap`;
    const outputPath = path.join(UPLOADS_DIR, outputFileName);
    
    const dpiEnginePath = path.join(__dirname, '..', 'dpi_engine');
    
    let cmdArgs = [inputPath, outputPath];
    
    rules.forEach(rule => {
        if (rule.type === 'ip') cmdArgs.push(`--block-ip`, rule.value);
        if (rule.type === 'app') cmdArgs.push(`--block-app`, rule.value);
        if (rule.type === 'domain') cmdArgs.push(`--block-domain`, rule.value);
    });
    
    // Command strings must be properly escaped if containing spaces, but here values shouldn't have spaces typically.
    // To be safe, we wrap args in quotes.
    const argsStr = cmdArgs.map(arg => `"${arg}"`).join(' ');
    const command = `"${dpiEnginePath}" ${argsStr}`;
    
    console.log('Running:', command);
    
    exec(command, (error, stdout, stderr) => {
        console.log("Stdout:", stdout);
        if (stderr) console.error("Stderr:", stderr);
        
        // The process might return 1 if there's usage error, or maybe we just ignore error code if we have output
        const report = parseOutput(stdout);
        
        // Also provide a way to download the file
        res.json({
            success: true,
            report,
            downloadUrl: `/api/download/${outputFileName}`
        });
    });
});

app.get('/api/download/:filename', (req, res) => {
    const file = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(file)) {
        res.download(file);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`DPI Engine Backend running on http://localhost:${PORT}`);
});
