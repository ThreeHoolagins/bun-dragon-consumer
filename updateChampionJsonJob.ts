import { exit } from "process";
import {LOCAL_VERSION_FILE_PATH, LOL_JERSEYS_REPO, LOCAL_SKINLINE_FILE_PATH, DATA_DRAGON_URL, LANG_SETTING} from "./environments.ts"

const getVersionFileFromDataDragon = async () => {
    var request = await Bun.fetch(`${DATA_DRAGON_URL}/api/versions.json`);
    return await request.json()
}

const versionFile = Bun.file(LOCAL_VERSION_FILE_PATH);
const versionFileExists = await versionFile.exists();
let currentVersion : string = "initalvalue";

if (versionFileExists) {
    const versionFileJson = await versionFile.json();
    const versionFromFile = versionFileJson[0];

    const versionFileFromDataDragon = await getVersionFileFromDataDragon()
    if (versionFromFile === versionFileFromDataDragon[0]) {
        currentVersion = versionFromFile;
        console.log(currentVersion);
        console.log("File already in current date, exiting . . .");
        exit(0);
    }
    else { // our local file exists, but it is outdated
        Bun.write(LOCAL_VERSION_FILE_PATH, JSON.stringify(versionFileFromDataDragon))
        currentVersion = versionFileFromDataDragon[0];
    }
}
else {
    const versionFileFromDataDragon = await getVersionFileFromDataDragon()
    Bun.write(LOCAL_VERSION_FILE_PATH, JSON.stringify(versionFileFromDataDragon))
    currentVersion = versionFileFromDataDragon[0];
}

console.log(currentVersion);

const getSkinLinesForChampion = async (championIdentifier : string) => {
    var call = await fetch(`${DATA_DRAGON_URL}/cdn/${currentVersion}/data/${LANG_SETTING}/champion/${championIdentifier}.json`);
    var champJson = await call.json();
    return champJson.data[championIdentifier].skins;
}

const championsListDDURL = `${DATA_DRAGON_URL}/cdn/${currentVersion}/data/${LANG_SETTING}/champion.json`;
const championsDataRequest = await fetch(championsListDDURL);
if (championsDataRequest.status === 200) {
    const championsDataJson = await championsDataRequest.json();
    let championSkinLineMap = new Map<string, any>();
    await Promise.all(
        Object.entries(championsDataJson.data).map(async (championDataJson : any) => {
            let championIdentifier = championDataJson[1].id;
            let championName = championDataJson[1].name;
            let champSkinLineJson = await getSkinLinesForChampion(championIdentifier);
            Object.entries(champSkinLineJson).forEach((championSkinJson : any) => {
                let skinLine = championSkinJson[1].name.replace(championName, "").trim();
                if (skinLine !== "default") {
                    if (!championSkinLineMap.has(skinLine)) {
                        championSkinLineMap.set(skinLine, [[championSkinJson[1].name.trim(), championIdentifier, championSkinJson[1].num]]);
                    }
                    else {
                        championSkinLineMap.set(skinLine, [...championSkinLineMap.get(skinLine), [championSkinJson[1].name.trim(), championIdentifier, championSkinJson[1].num]]);
                    }
                }
            })
        })
    )
    championSkinLineMap = new Map([...championSkinLineMap.entries()].sort());
    championSkinLineMap.forEach((value : any, key : any) => {
        if (value.length < 5) {
            championSkinLineMap.delete(key)
        }
    });

    const outputObject: { [key: string]: any } = {};
    for (let [key, value] of championSkinLineMap) {
        outputObject[key] = value;
    }

    console.log(championSkinLineMap.size)
    Bun.write(LOCAL_SKINLINE_FILE_PATH, JSON.stringify(outputObject))
    console.log(`File written successfully to ${LOCAL_SKINLINE_FILE_PATH}`);
    const gitUnstageAll = Bun.spawn(["git", "restore", "--staged", "."], {cwd:LOL_JERSEYS_REPO});
    await gitUnstageAll.exited;
    const gitStageFile = Bun.spawn(["git", "add", LOCAL_SKINLINE_FILE_PATH], {cwd:LOL_JERSEYS_REPO});
    await gitStageFile.exited;
    const gitCommit = Bun.spawn(["git", "commit", "-m", `Updating skinLineData.json to version ${currentVersion}`], {cwd:LOL_JERSEYS_REPO});
    await gitCommit.exited;
    const gitPush = Bun.spawn(["git", "push"], {cwd:LOL_JERSEYS_REPO});
    await gitPush.exited;
    console.log("Job Completed Successfully")
}
else {
    console.log("System Failed, we'll get the championDataRequest next time")
    exit(1)
}