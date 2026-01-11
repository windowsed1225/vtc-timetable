// import * as fs from "node:fs/promises";
// import json from "../data/semester_2_combined.json" assert { type: "json" };
import { API } from "./core/api";
import { Icsgenerator } from "./core/ics";
import * as utils from "./core/utils";
// const client = new API({ token: "B4E79A05-806B-32F0-618C-C2DE694215B7" });
// // const getSemTimetable = await utils.semster_timetable(client, 2);
// // console.log("Semester timetable fetched:", getSemTimetable.legnth);
// // const icsGenerator = new Icsgenerator();

// // await icsGenerator.generateIcsFiles(json, 2).then((icsString) => {
// //     fs.writeFile(`semester_2_classes.ics`, icsString as string);
// // });

// // lIST all json sourceCode
// json.forEach((item: any) => {
//     console.log(item.courseCode);
// });


export { API, Icsgenerator, utils };

