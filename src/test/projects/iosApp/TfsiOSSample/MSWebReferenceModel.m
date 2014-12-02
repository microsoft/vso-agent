// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
