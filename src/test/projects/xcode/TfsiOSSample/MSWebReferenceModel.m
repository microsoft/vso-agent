// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// ----------------------------------------------------------------------------
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

#import "MSWebReferenceModel.h"

@interface MSWebReferenceModel () {
    NSMutableArray *_objects;
}
@end

@implementation MSWebReferenceModel

- (id)init {
    self = [super init];
    if (self)
    {
        _objects =  [[NSMutableArray alloc] init];
    }
    
    return self;
}

///////////////////////////////////////////////////////////////////////////
#pragma mark -
#pragma mark Read Methods
#pragma mark -
///////////////////////////////////////////////////////////////////////////
- (NSInteger)count
{
    return [_objects count];
}

-(MSWebReference*)webReferenceAtIndex: (NSInteger)index
{
    MSWebReference* webRef = nil;
    
    if (index < self.count)
    {
        webRef = [_objects objectAtIndex:index];
    }
    
    return webRef;
}


///////////////////////////////////////////////////////////////////////////
#pragma mark -
#pragma mark Modify Methods
#pragma mark -
///////////////////////////////////////////////////////////////////////////

-(void)addWebReference:(MSWebReference*)webReference
{
    [_objects addObject:webReference];
}

-(void)addWebReferenceNamed: (NSString*)name withURLString:(NSString*)string
{
    MSWebReference *ref = [[[MSWebReference alloc] initWithName:name URL:string] autorelease];
    [self addWebReference:ref];
}
@end
