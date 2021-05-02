import axios from "axios";
import { JSDOM } from "jsdom";
import fs from "fs";

const FILENAME = 'data.csv';

const start = async () => {
    fs.appendFile(
        FILENAME,
        'kursus,fakultet,institut,termin,ects,antal tilmeldte,fremmødte,antal bestået,% bestået af tilmeldte, % bestået af fremmødte,eksamensgennemsnit\n',
        (err) => { if (err) throw err; });

    let i = 1;
    const links: string[] = [];
    while(true) {
        console.log(i);
        const resp = await axios.post('https://karakterstatistik.stads.ku.dk/Search/Courses', {
            searchText: "",
            term: "Winter-2020",
            block: "",
            faculty: "",
            institute: null,
            page: i
        });
        // console.log(resp.data)
        if (resp.data.includes('Søgning returnerede ingen resultater.')) {
            break;
        }

        const dom = new JSDOM(resp.data);
        dom.window.document.querySelectorAll('a').forEach(a => {
            links.push(a.href)
        });
        i++;
    }


    for (const link of links) {
        console.log(link);
        let resp = await axios.get(link).catch(err => (err.response.status as number));
        if (typeof resp === 'number') {
            if (resp !== 500) console.log(`Got response code ${resp}`);
            continue;
        }

        const dom = new JSDOM(resp.data);
        const title = dom.window.document.querySelector('h2')?.textContent?.trim();
        const trs = Array.from(dom.window.document.querySelectorAll('tr'));
        const get_tds = (search: string): HTMLTableCellElement[] => {
            let result = undefined;
            trs.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length > 0 && tds[0].textContent?.toUpperCase().includes(search.toUpperCase())) {
                    result = tds;
                }
            });
            return result ?? [];
        }

        const fakultet = get_tds('Fakultet')[1]?.textContent?.trim();
        const institut = get_tds('Institut')[1]?.textContent?.trim();
        const termin = get_tds('Termin')[1]?.textContent?.trim();
        const ects = get_tds('ECTS')[1]?.textContent?.trim();

        const o_tilmeldte = get_tds('Antal tilmeldte')[1]?.textContent?.trim();
        const o_frem = get_tds('Fremmødte')[1]?.textContent?.trim();
        const o_bestaaet_full = get_tds('Antal bestået')[1]?.textContent?.trim();

        const o_bestaaet = o_bestaaet_full?.substr(0, o_bestaaet_full.indexOf("(")).trim();

        const b_procent_tilmeldte = /\((\d+)/g.exec(o_bestaaet_full ?? '') ?? [];
        const b_procent_frem = /af de tilmeldte,\s(\d+)/g.exec(o_bestaaet_full ?? '') ?? [];

        const o_bestaaet_procent_tilmeldte = b_procent_tilmeldte[1] ?? '';
        const o_bestaaet_procent_frem = b_procent_frem[1] ?? '';

        let o_snit = get_tds('Eksamensgennemsnit')[1]?.textContent?.trim();
        if (o_snit?.includes('(Efter 7-trinsskalaen)')) {
            o_snit = o_snit.substr(0, o_snit.indexOf(" (")).trim();
        }

        fs.appendFile(
            FILENAME,
            `"${title}","${fakultet}","${institut}","${termin}","${ects}","${o_tilmeldte}","${o_frem}","${o_bestaaet}",${o_bestaaet_procent_tilmeldte},${o_bestaaet_procent_frem},"${o_snit}"\n`,
            (err) => { if (err) throw err; });
    }

}
start().catch(console.error);
