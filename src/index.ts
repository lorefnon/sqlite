import BetterSqlite3Database from "better-sqlite3";

export interface Query {
  source: string;
  parameters: any[];
}

export function sql(
  template: TemplateStringsArray,
  ...substitutions: any[]
): Query {
  const sourceParts: string[] = [];
  const parameters: any[] = [];

  for (
    let templateIndex = 0;
    templateIndex < template.length - 1;
    templateIndex++
  ) {
    const templatePart = template[templateIndex];
    const parameter = substitutions[templateIndex];

    if (templatePart.endsWith("$")) {
      if (
        typeof parameter.source !== "string" ||
        !Array.isArray(parameter.parameters)
      )
        throw new Error(
          `Failed to interpolate raw query ‘${parameter}’ because it wasn’t created with the sql tagged template literal`
        );
      sourceParts.push(templatePart.slice(0, -1), parameter.source);
      parameters.push(...parameter.parameters);
    } else {
      sourceParts.push(templatePart, "?");
      parameters.push(parameter);
    }
  }
  sourceParts.push(template[template.length - 1]);

  return { source: sourceParts.join(""), parameters };
}

export interface Options {
  safeIntegers?: boolean;
}

// FIXME: Use BetterSqlite3Database generics: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/50794
// FIXME: Use more straightforward inheritance: https://github.com/JoshuaWise/better-sqlite3/issues/551
export class Database extends BetterSqlite3Database {
  statements: Map<string, BetterSqlite3Database.Statement> = new Map();

  run: (query: Query, options?: Options) => BetterSqlite3Database.RunResult = (
    query,
    options = {}
  ) => {
    return this.getStatement(query.source, options).run(query.parameters);
  };

  get: <T>(query: Query, options?: Options) => T | undefined = (
    query,
    options = {}
  ) => {
    return this.getStatement(query.source, options).get(query.parameters);
  };

  all: <T>(query: Query, options?: Options) => T[] = (query, options = {}) => {
    return this.getStatement(query.source, options).all(query.parameters);
  };

  iterate: <T>(query: Query, options?: Options) => IterableIterator<T> = (
    query,
    options = {}
  ) => {
    return this.getStatement(query.source, options).iterate(query.parameters);
  };

  execute: (query: Query) => this = (query) => {
    if (query.parameters.length > 0)
      throw new Error(
        `Failed to execute(${JSON.stringify(
          query,
          undefined,
          2
        )}) because execute() doesn’t support queries with parameters`
      );
    return this.exec(query.source);
  };

  executeTransaction: <T>(fn: () => T) => T = (fn) => {
    return this.transaction(fn)();
  };

  executeTransactionImmediate: <T>(fn: () => T) => T = (fn) => {
    return this.transaction(fn).immediate();
  };

  executeTransactionExclusive: <T>(fn: () => T) => T = (fn) => {
    return this.transaction(fn).exclusive();
  };

  getStatement: (
    source: string,
    options?: Options
  ) => BetterSqlite3Database.Statement = (source, options = {}) => {
    let statement = this.statements.get(source);
    if (statement === undefined) {
      statement = this.prepare(source);
      this.statements.set(source, statement);
    }
    statement.safeIntegers(options.safeIntegers ?? false);
    return statement;
  };
}
