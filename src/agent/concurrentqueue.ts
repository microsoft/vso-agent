import Q = require('q');

export class ConcurrentArray<TValue> {
    private _finishedAdding: boolean = false;
    private _processing: boolean = false;
    private _finalBatch: boolean = false;
    private _process: (values: TValue[], callback: (err) => void) => void;
    private _onError: (err: any) => void;
    private _msDelay: number;
    private _currentArray: TValue[] = [];
    private _deferred: Q.Deferred<any> = Q.defer();

    constructor(process: (values: TValue[], callback: (err) => void) => void, onError: (err: any) => void, msDelay: number) {
        this._process = process;
        this._onError = onError;
        this._msDelay = msDelay;
    }

    public push(value: TValue) {
        if (this._finishedAdding) {
            // be passive - if we shut the queue off, then just don't queue the item
            return;
        }

        this._currentArray.push(value);
    }

    public startProcessing() {
        if (!this._processing && !this._finishedAdding) {
            this._processing = true;
            this._processMoreBatches();
        }
    }

    public waitForEmpty(): Q.Promise<any> {
        return this._deferred.promise;
    }

    public finishAdding() {
        this._finishedAdding = true;
    }

    private _processMoreBatches() {
        if (!this._finishedAdding) {
            setTimeout(() => {
                this._processBatch();
            }, this._msDelay);
        }
        else if (!this._finalBatch) {
            this._finalBatch = true;
            this._processBatch();
        }
        else {
            this._deferred.resolve(null);
        }
    }

    private _processBatch() {
        // swap arrays
        var values = this._currentArray;
        this._currentArray = [];

        this._process(values, (err: any) => {
            if (err) {
                this._onError(err);
            }
            this._processMoreBatches();
        });
    }
}

export class ConcurrentBatch<TValue> {
    private _finishedAdding: boolean = false;
    private _processing: boolean = false;
    private _finalBatch: boolean = false;
    private _factory: (key: string) => TValue;
    private _process: (values: TValue[], callback: (err) => void) => void;
    private _onError: (err: any) => void;
    private _msDelay: number;
    private _currentBatch: { [key: string]: TValue; } = {};
    private _deferred: Q.Deferred<any> = Q.defer();

    constructor(factory: (key: string) => TValue, process: (values: TValue[], callback: (err) => void) => void, onError: (err: any) => void, msDelay: number) {
        this._factory = factory;
        this._process = process;
        this._onError = onError;
        this._msDelay = msDelay;
    }

    public getOrAdd(key: string): TValue {
        if (this._finishedAdding) {
            var error = new Error("can't add to finished batch");
            throw error;
        }

        var item: TValue = this._currentBatch[key];
        if (!item) {
            item = this._factory(key);
            this._currentBatch[key] = item;
        }
        return item;
    }

    public startProcessing() {
        if (!this._processing && !this._finishedAdding) {
            this._processing = true;
            this._processMoreBatches();
        }
    }

    public waitForEmpty(): Q.Promise<any> {
        return this._deferred.promise;
    }

    public finishAdding() {
        this._finishedAdding = true;
    }

    private _processMoreBatches() {
        if (!this._finishedAdding) {
            setTimeout(() => {
                this._processBatch();
            }, this._msDelay);
        }
        else if (!this._finalBatch) {
            this._finalBatch = true;
            this._processBatch();
        }
        else {
            this._deferred.resolve(null);
        }
    }

    private _processBatch() {
        // swap batches
        var batch = this._currentBatch;
        this._currentBatch = {};

        var values: TValue[] = [];
        for (var key in batch) {
            if (batch.hasOwnProperty(key)) {
                values.push(batch[key]);
            }
        }

        this._process(values, (err: any) => {
            if (err) {
                this._onError(err);
            }
            this._processMoreBatches();
        });
    }
} 