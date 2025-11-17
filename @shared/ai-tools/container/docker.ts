// Docker container utilities
import { exec } from 'child_process';

export class DockerContainer {
  constructor(private imageName: string) {}

  async run(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(`docker run ${this.imageName} ${command}`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }
}
