// Map creation
const mainMap = L.map('mainMap').setView([32.0879, 34.7934], 13);
const tiles = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {}).addTo(mainMap);

let currentMarkerGroup; // the currently displayed marker layer 
let currentBikesUrl = "https://mds.bird.co/gbfs/tel-aviv/free_bikes";
//let currentBikesUrl = "https://api.helbiz.com/admin/reporting/palermo/gbfs/gbfs.json";
var hash = new L.Hash(mainMap);

// Some GBFS systems do not support cross origin requests
async function fetchWithCors(url) {
    return await fetch('https://cors.idoco.workers.dev/?' + url);
}

async function loadBikes(url) {
    let response = await fetchWithCors(url + '?time=' + Date.now());
    let freeBikes = await response.json();
    return freeBikes.data.bikes;
}

async function refreshBikes(url) {
    document.getElementById("loader").style.display = "block"
    try {
        if (currentMarkerGroup) { // clear current markers before showing new
            mainMap.removeLayer(currentMarkerGroup);
        }
        let bikes = await loadBikes(url);
        await showBikes(bikes)
    } catch (e) {
        console.log(e);
    }
    document.getElementById("loader").style.display = "none";
}

async function showBikes(bikes) {
    let markers = [];
    for (let i in bikes) {
        let bike = bikes[i];
        let marker = L.marker([bike.lat, bike.lon])
            .bindPopup(
                `bike_id: ${bike.bike_id}<br/>
                is_disabled: ${!!bike.is_disabled}
                <br/>is_reserved: ${!!bike.is_reserved}
                <br/>vehicle_type: ${bike.vehicle_type || 'unknown'}`
            );
        markers.push(marker);
    }

    document.getElementById('bike-count').textContent = bikes.length || 'N/A'

    currentMarkerGroup = L.featureGroup(markers).addTo(mainMap);
    mainMap.fitBounds(currentMarkerGroup.getBounds());
}

async function loadCsv(url) {
    let response = await fetch(url);
    let rawCsv = await response.text()
    let csv = $.csv.toArrays(rawCsv)
    csv.shift() // remove csv header row
    csv.unshift(["IL", "Bird gbfs", "Tel Aviv", "BIRD_TLV", "bird.co", 'https://mds.bird.co/gbfs']); // Add bird 
    return csv;
}

async function main() {
    const csv = await loadCsv('https://raw.githubusercontent.com/NABSA/gbfs/master/systems.csv');
    const selectSystem = document.getElementById("select-system");

    for (let i in csv) {
        let opt = csv[i][1];
        let el = document.createElement("option");
        el.textContent = opt;
        el.value = opt;
        selectSystem.appendChild(el);
    }

    selectSystem.addEventListener("change", async() => {
        document.getElementById("loader").style.display = "block"

        const selectedIndex = document.getElementById("select-system").selectedIndex;
        const systemUrl = csv[selectedIndex][5];
        const systemUrlResponse = await fetchWithCors(systemUrl + '?time=' + Date.now());
        const systemData = await systemUrlResponse.json();

        if (systemData.data && systemData.data.en && systemData.data.en.feeds) {
            const feeds = systemData.data.en.feeds;
            for (let i in feeds) {
                if (feeds[i].name == 'free_bike_status' || feeds[i].name == 'free_bikes') {
                    currentBikesUrl = feeds[i].url;
                    await refreshBikes(currentBikesUrl)
                    break;
                }
            }
        }
        document.getElementById("loader").style.display = "none";
    });

    document.getElementById("refresh-button").addEventListener('click', () => {
        refreshBikes(currentBikesUrl)
    })

    // Load bird Tel aviv on launch
    await refreshBikes('https://mds.bird.co/gbfs/tel-aviv/free_bikes')
        //await refreshBikes('https://api.helbiz.com/admin/reporting/palermo/gbfs/gbfs.json')
}

main();