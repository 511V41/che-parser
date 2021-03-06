import iconv from "iconv-lite";
import { promises as fs } from "fs";
import { program } from "commander";

import map from "./map";
import machines from "./machines";

interface OKE {
  name: string;
  nickname: string;
  position?: number;
}

interface Team {
  name: string;
  owner: string;
  okes: (OKE | undefined)[];
}

// なぜかゴミが入ってることがあるので消す
const deleteTrash = (buf: Buffer): Buffer => {
  const index = buf.indexOf(0x00);
  if (index !== -1) {
    return buf.slice(0, index);
  }
  return buf;
};

// 識別名が初期値か？
const isMachineNameInitialValue = (buf: Buffer): boolean => {
  const index = buf.indexOf(0xff);
  if (index !== -1) {
    return true;
  }
  return false;
};

// OKEの名前と識別名を取得する
const machine = (
  registered: Buffer,
  id: Buffer,
  name: Buffer
): OKE | undefined => {
  if (registered.toString("hex") === "00") {
    return undefined;
  }
  const machineName = machines[id.toString("hex")];
  if (!machineName) {
    console.error("存在しないOKEが登録されています。");
    process.exit(1);
  }
  const identifierName = iconv.decode(name, "Shift_JIS");
  if (
    isMachineNameInitialValue(name) ||
    identifierName.replace(/\0/g, "") === ""
  ) {
    return {
      name: machineName,
      nickname: machineName
    };
  }
  // なぜかmachineNameと一致するidentifierNameが存在する場合がある
  if (machineName === identifierName) {
    return {
      name: machineName,
      nickname: machineName
    };
  }
  return {
    name: machineName,
    nickname: identifierName
  };
};

const main = async (): Promise<void> => {
  const team: Team = {
    name: "",
    owner: "",
    okes: new Array(3).fill(undefined)
  };
  const path = program.file;
  if (!path) {
    console.error(
      "ファイルパスを指定してください。詳しくは `che-parse -h` で確認できます。"
    );
    process.exit(1);
  }
  const data = await fs.readFile(path).catch(err => {
    console.error("ファイルを読み込めませんでした。", err);
    process.exit(1);
  });
  if (data.length !== 24512) {
    console.error("ファイル形式がおかしいです。");
    process.exit(1);
  }
  team.name = iconv.decode(
    deleteTrash(data.slice(...map.teamName)),
    "Shift_JIS"
  );
  team.owner = iconv.decode(
    deleteTrash(data.slice(...map.ownerName)),
    "Shift_JIS"
  );

  const machine1 = machine(
    data.slice(...map.registered1),
    data.slice(...map.machine1),
    deleteTrash(data.slice(...map.machineName1))
  );
  const machine2 = machine(
    data.slice(...map.registered2),
    data.slice(...map.machine2),
    deleteTrash(data.slice(...map.machineName2))
  );
  const machine3 = machine(
    data.slice(...map.registered3),
    data.slice(...map.machine3),
    deleteTrash(data.slice(...map.machineName3))
  );

  const which = (id: string, index: number): void => {
    if (id.replace(/\0/g, "") === "") {
      team.okes[index] = Object.assign({}, machine1);
    }
    if (id === "01") {
      team.okes[index] = Object.assign({}, machine2);
    }
    if (id === "02") {
      team.okes[index] = Object.assign({}, machine3);
    }
  };

  which(deleteTrash(data.slice(...map.whichMachine1)).toString("hex"), 0);
  which(deleteTrash(data.slice(...map.whichMachine2)).toString("hex"), 1);
  which(deleteTrash(data.slice(...map.whichMachine3)).toString("hex"), 2);

  team.okes = team.okes.map((oke, index): OKE | undefined => {
    if (oke) {
      oke.position = data.readUIntBE(map.machinePositions[index], 1);
    }
    return oke;
  });

  console.info(JSON.stringify(team, null, "  "));
};

export default main;
